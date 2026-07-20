import { createHmac } from "node:crypto";
import type { OrderCall } from "@prisma/client";
import db from "../db.server";
import { unauthenticated } from "../shopify.server";
import {
  DialnexaApiError,
  normalizePhoneNumber,
  triggerOutboundCall,
} from "./dialnexa.server";
import {
  isInQuietHours,
  selectOrderWorkflow,
  type ActivatedRuntimeUseCase,
} from "./use-case-runtime";

const MAX_ATTEMPTS = 5;
const STALE_LOCK_MINUTES = 5;

type StoredUseCases = Record<string, ActivatedRuntimeUseCase>;

interface ShopifyOrderData {
  id: string;
  name?: string;
  paymentGatewayNames?: string[];
  customer?: {
    firstName?: string | null;
    phone?: string | null;
  } | null;
  shippingAddress?: { phone?: string | null } | null;
  billingAddress?: { phone?: string | null } | null;
  totalPriceSet?: {
    shopMoney?: { amount?: string; currencyCode?: string };
  };
  lineItems?: {
    nodes?: Array<{ name?: string; quantity?: number }>;
  };
}

interface ShopifyJobContext {
  shop?: { ianaTimezone?: string };
  order?: ShopifyOrderData | null;
  currentAppInstallation?: {
    apiKeyMetafield?: { value?: string };
    useCasesMetafield?: { value?: string };
  };
}

function recipientHash(shop: string, phoneNumber: string): string {
  const secret = process.env.PHONE_HASH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("PHONE_HASH_SECRET must contain at least 32 characters");
  }
  return createHmac("sha256", secret)
    .update(`${shop}:${phoneNumber}`)
    .digest("hex");
}

function parseUseCases(value?: string): StoredUseCases {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function claimNextOrderCall(): Promise<OrderCall | null> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MINUTES * 60 * 1_000);
  const candidate = await db.orderCall.findFirst({
    where: {
      OR: [
        { status: "queued", availableAt: { lte: now } },
        {
          status: "failed",
          availableAt: { lte: now },
          attempts: { lt: MAX_ATTEMPTS },
        },
        { status: "processing", lockedAt: { lt: staleBefore } },
      ],
    },
    orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
  });

  if (!candidate) return null;

  const claimed = await db.orderCall.updateMany({
    where: {
      id: candidate.id,
      status: candidate.status,
      updatedAt: candidate.updatedAt,
    },
    data: {
      status: "processing",
      lockedAt: now,
      attempts: { increment: 1 },
      error: null,
    },
  });

  if (claimed.count !== 1) return null;

  return {
    ...candidate,
    status: "processing",
    lockedAt: now,
    attempts: candidate.attempts + 1,
    error: null,
  };
}

async function loadShopifyContext(
  shop: string,
  orderId: string,
): Promise<ShopifyJobContext> {
  const { admin } = await unauthenticated.admin(shop);
  const response = await admin.graphql(
    `
    #graphql
    query OrderCallJob($orderId: ID!) {
      shop { ianaTimezone }
      order(id: $orderId) {
        id
        name
        paymentGatewayNames
        customer { firstName phone }
        shippingAddress { phone }
        billingAddress { phone }
        totalPriceSet { shopMoney { amount currencyCode } }
        lineItems(first: 10) { nodes { name quantity } }
      }
      currentAppInstallation {
        apiKeyMetafield: metafield(namespace: "dialnexa", key: "api_key") { value }
        useCasesMetafield: metafield(namespace: "dialnexa", key: "use_cases") { value }
      }
    }
    `,
    { variables: { orderId: `gid://shopify/Order/${orderId}` } },
  );
  const json = (await response.json()) as {
    data?: ShopifyJobContext;
    errors?: Array<{ message?: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || "Shopify order query failed");
  }

  return json.data || {};
}

async function markSkipped(job: OrderCall, reason: string): Promise<void> {
  await db.orderCall.update({
    where: { id: job.id },
    data: {
      status: "skipped",
      error: reason.slice(0, 1_000),
      lockedAt: null,
    },
  });
}

async function deferForQuietHours(job: OrderCall): Promise<void> {
  await db.orderCall.update({
    where: { id: job.id },
    data: {
      status: "queued",
      availableAt: new Date(Date.now() + 30 * 60 * 1_000),
      lockedAt: null,
      attempts: { decrement: 1 },
      error: "Deferred during configured quiet hours",
    },
  });
}

async function processOrderCall(job: OrderCall): Promise<void> {
  const context = await loadShopifyContext(job.shop, job.orderId);
  const order = context.order;
  const installation = context.currentAppInstallation;

  if (!order) {
    await markSkipped(job, "Shopify order no longer exists or is inaccessible");
    return;
  }

  const apiKey = installation?.apiKeyMetafield?.value;
  const useCases = parseUseCases(installation?.useCasesMetafield?.value);
  const selection = selectOrderWorkflow(
    order.paymentGatewayNames || [],
    useCases,
  );

  if (!apiKey || !selection) {
    await markSkipped(
      job,
      !apiKey
        ? "Dialnexa API key is not configured"
        : "No eligible order workflow is active",
    );
    return;
  }

  if (!selection.configuration.consentAttested) {
    await markSkipped(job, "Merchant consent attestation is missing");
    return;
  }

  const timezone = context.shop?.ianaTimezone || "UTC";
  if (
    isInQuietHours(
      new Date(),
      timezone,
      selection.configuration.quietHoursStart || "20:00",
      selection.configuration.quietHoursEnd || "09:00",
    )
  ) {
    await deferForQuietHours(job);
    return;
  }

  const rawPhone =
    order.customer?.phone ||
    order.shippingAddress?.phone ||
    order.billingAddress?.phone ||
    "";
  const phoneNumber = normalizePhoneNumber(rawPhone);

  if (!phoneNumber) {
    await markSkipped(job, "The order has no valid E.164 phone number");
    return;
  }

  const hashedRecipient = recipientHash(job.shop, phoneNumber);
  const suppression = await db.callSuppression.findUnique({
    where: {
      shop_recipientHash: {
        shop: job.shop,
        recipientHash: hashedRecipient,
      },
    },
  });
  if (suppression) {
    await markSkipped(job, `Recipient suppressed: ${suppression.reason}`);
    return;
  }

  const maxCallsPer24Hours = Math.max(
    1,
    Math.min(selection.configuration.maxCallsPer24Hours || 1, 3),
  );
  const recentCalls = await db.orderCall.count({
    where: {
      id: { not: job.id },
      shop: job.shop,
      recipientHash: hashedRecipient,
      status: "succeeded",
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1_000) },
    },
  });
  if (recentCalls >= maxCallsPer24Hours) {
    await markSkipped(
      job,
      "Recipient frequency cap reached for the last 24 hours",
    );
    return;
  }

  await db.orderCall.update({
    where: { id: job.id },
    data: {
      workflow: selection.workflow,
      recipientHash: hashedRecipient,
    },
  });

  const money = order.totalPriceSet?.shopMoney;
  const orderItems = (order.lineItems?.nodes || [])
    .map(({ name, quantity }) =>
      name ? `${quantity && quantity > 1 ? `${quantity} × ` : ""}${name}` : "",
    )
    .filter(Boolean)
    .join(", ");
  const result = await triggerOutboundCall(
    apiKey,
    selection.agentId,
    phoneNumber,
    {
      customer_name: order.customer?.firstName || "Valued Customer",
      order_number: order.name || job.orderId,
      order_items: orderItems,
      order_total: money?.amount || "",
      currency: money?.currencyCode || "",
      shop: job.shop,
      shopify_order_id: job.orderId,
      workflow: selection.workflow,
    },
  );
  const dialnexaCallId =
    result.id || result.call_id || result.data?.id || result.data?.call_id;

  await db.orderCall.update({
    where: { id: job.id },
    data: {
      workflow: selection.workflow,
      status: "succeeded",
      dialnexaCallId,
      error: null,
      lockedAt: null,
    },
  });
}

async function markFailed(job: OrderCall, error: unknown): Promise<void> {
  const message =
    error instanceof Error ? error.message.slice(0, 1_000) : "Unknown error";
  const permanentDialnexaError =
    error instanceof DialnexaApiError && error.status < 500;
  const isDead = permanentDialnexaError || job.attempts >= MAX_ATTEMPTS;
  const retryDelayMinutes = Math.min(2 ** job.attempts, 60);

  await db.orderCall.update({
    where: { id: job.id },
    data: {
      status: isDead ? "dead" : "failed",
      error: message,
      lockedAt: null,
      availableAt: new Date(Date.now() + retryDelayMinutes * 60 * 1_000),
    },
  });

  console.error(
    `Order-call job ${job.id} ${isDead ? "died" : "failed"}: ${message}`,
  );
}

export async function processOrderCallQueue(
  maxJobs = 3,
): Promise<{ processed: number }> {
  let processed = 0;

  while (processed < maxJobs) {
    const job = await claimNextOrderCall();
    if (!job) break;

    try {
      await processOrderCall(job);
    } catch (error) {
      await markFailed(job, error);
    }
    processed += 1;
  }

  return { processed };
}
