import { Prisma } from "@prisma/client";
import db from "../db.server";
import { unauthenticated } from "../shopify.server";
import {
  decryptCallPayload,
  encryptCallPayload,
} from "./call-payload-crypto.server";
import { normalizePhoneNumber } from "./dialnexa.server";
import { enqueueUseCaseCall } from "./use-case-call-queue.server";
import { validateCallMetadata } from "./use-case-runtime";

const SHOP_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const INVENTORY_ITEM_PATTERN = /^(?:gid:\/\/shopify\/InventoryItem\/)?(\d+)$/;

export interface StockAlertInput {
  shop: string;
  inventoryItemId: string;
  dedupeKey: string;
  phoneNumber: string;
  customerName: string;
  productName: string;
  productUrl: string;
  productVariant?: string;
  productPrice?: string;
  consentRecordedAt: Date;
}

function numericInventoryItemId(value: string): string {
  const match = value.match(INVENTORY_ITEM_PATTERN);
  if (!match) throw new Error("inventory_item_id must be a Shopify InventoryItem ID");
  return match[1];
}

export async function subscribeToStockAlert(
  input: StockAlertInput,
): Promise<{ id: string; duplicate: boolean }> {
  if (!SHOP_PATTERN.test(input.shop)) throw new Error("Invalid Shopify domain");
  if (!input.dedupeKey || input.dedupeKey.length > 200) {
    throw new Error("dedupe_key must contain 1 to 200 characters");
  }
  if (
    Number.isNaN(input.consentRecordedAt.getTime()) ||
    input.consentRecordedAt.getTime() > Date.now() + 5 * 60_000
  ) {
    throw new Error("consent_recorded_at must be a valid past ISO-8601 date-time");
  }
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  if (!phoneNumber) throw new Error("phone_number must be valid E.164");
  const metadata = {
    customer_name: input.customerName,
    product_name: input.productName,
    product_url: input.productUrl,
    ...(input.productVariant ? { product_variant: input.productVariant } : {}),
    ...(input.productPrice ? { product_price: input.productPrice } : {}),
    availability_context: "Shopify inventory is currently available",
  };
  const errors = validateCallMetadata("back_in_stock", metadata);
  if (errors.length) throw new Error(errors.join("; "));

  try {
    const subscription = await db.stockAlertSubscription.create({
      data: {
        shop: input.shop,
        inventoryItemId: numericInventoryItemId(input.inventoryItemId),
        dedupeKey: input.dedupeKey,
        encryptedPayload: encryptCallPayload({ phoneNumber, metadata }),
        consentRecordedAt: input.consentRecordedAt,
      },
      select: { id: true },
    });
    return { id: subscription.id, duplicate: false };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await db.stockAlertSubscription.findUniqueOrThrow({
        where: {
          shop_dedupeKey: { shop: input.shop, dedupeKey: input.dedupeKey },
        },
        select: { id: true },
      });
      return { id: existing.id, duplicate: true };
    }
    throw error;
  }
}

export async function cancelStockAlert(
  shop: string,
  dedupeKey: string,
): Promise<boolean> {
  if (!SHOP_PATTERN.test(shop)) throw new Error("Invalid Shopify domain");
  const result = await db.stockAlertSubscription.updateMany({
    where: { shop, dedupeKey, status: "pending" },
    data: { status: "cancelled", encryptedPayload: "" },
  });
  return result.count > 0;
}

export async function processInventoryAvailability(input: {
  shop: string;
  webhookId: string;
  inventoryItemId: string | number;
  available: number;
}): Promise<{ matched: number; queued: number }> {
  if (!Number.isFinite(input.available) || input.available <= 0) {
    return { matched: 0, queued: 0 };
  }
  const { admin } = await unauthenticated.admin(input.shop);
  const activationResponse = await admin.graphql(`
    #graphql
    query StockAlertActivation {
      currentAppInstallation {
        useCasesMetafield: metafield(namespace: "dialnexa", key: "use_cases") { value }
      }
    }
  `);
  const activationJson = (await activationResponse.json()) as {
    data?: { currentAppInstallation?: { useCasesMetafield?: { value?: string } } };
    errors?: Array<{ message?: string }>;
  };
  if (activationJson.errors?.length) {
    throw new Error(activationJson.errors[0]?.message || "Could not verify stock-alert activation");
  }
  try {
    const all = JSON.parse(
      activationJson.data?.currentAppInstallation?.useCasesMetafield?.value || "{}",
    ) as Record<string, { enabled?: boolean; consentAttested?: boolean; agentId?: string }>;
    const configuration = all.back_in_stock;
    if (!configuration?.enabled || !configuration.consentAttested || !configuration.agentId) {
      return { matched: 0, queued: 0 };
    }
  } catch {
    return { matched: 0, queued: 0 };
  }
  const inventoryItemId = numericInventoryItemId(String(input.inventoryItemId));
  const subscriptions = await db.stockAlertSubscription.findMany({
    where: { shop: input.shop, inventoryItemId, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  let queued = 0;
  for (const subscription of subscriptions) {
    try {
      const payload = decryptCallPayload(subscription.encryptedPayload);
      const call = await enqueueUseCaseCall({
        shop: input.shop,
        useCaseId: "back_in_stock",
        source: "inventory_levels/update",
        dedupeKey: `stock:${subscription.id}:${input.webhookId}`,
        phoneNumber: payload.phoneNumber,
        metadata: payload.metadata,
      });
      await db.stockAlertSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "notified",
          notifiedAt: new Date(),
          encryptedPayload: "",
        },
      });
      if (!call.duplicate) queued += 1;
    } catch (error) {
      console.error(`Could not queue stock alert ${subscription.id}:`, error);
    }
  }
  return { matched: subscriptions.length, queued };
}
