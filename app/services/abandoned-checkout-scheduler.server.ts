import db from "../db.server";
import { unauthenticated } from "../shopify.server";
import { enqueueUseCaseCall } from "./use-case-call-queue.server";

interface AbandonedCheckoutNode {
  id: string;
  completedAt?: string | null;
  updatedAt: string;
  abandonedCheckoutUrl: string;
  customer?: { firstName?: string | null; phone?: string | null } | null;
  shippingAddress?: { phone?: string | null } | null;
  billingAddress?: { phone?: string | null } | null;
  totalPriceSet?: {
    shopMoney?: { amount?: string; currencyCode?: string };
  };
  lineItems?: { nodes?: Array<{ title?: string; quantity?: number }> };
}

interface SchedulerContext {
  currentAppInstallation?: {
    useCasesMetafield?: { value?: string };
  };
  abandonedCheckouts?: { nodes?: AbandonedCheckoutNode[] };
}

function isActivated(value?: string): boolean {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value) as Record<
      string,
      { enabled?: boolean; consentAttested?: boolean; agentId?: string }
    >;
    const configuration = parsed.abandoned_checkout;
    return Boolean(
      configuration?.enabled &&
      configuration.consentAttested &&
      configuration.agentId,
    );
  } catch {
    return false;
  }
}

async function scanShop(shop: string, now: Date): Promise<number> {
  const { admin } = await unauthenticated.admin(shop);
  const response = await admin.graphql(`
    #graphql
    query AbandonedCheckoutCallCandidates {
      currentAppInstallation {
        useCasesMetafield: metafield(namespace: "dialnexa", key: "use_cases") { value }
      }
      abandonedCheckouts(first: 20, reverse: true, sortKey: UPDATED_AT) {
        nodes {
          id
          completedAt
          updatedAt
          abandonedCheckoutUrl
          customer { firstName phone }
          shippingAddress { phone }
          billingAddress { phone }
          totalPriceSet { shopMoney { amount currencyCode } }
          lineItems(first: 10) { nodes { title quantity } }
        }
      }
    }
  `);
  const json = (await response.json()) as {
    data?: SchedulerContext;
    errors?: Array<{ message?: string }>;
  };
  if (json.errors?.length) {
    throw new Error(
      json.errors[0]?.message || "Abandoned checkout query failed",
    );
  }
  const context = json.data;
  if (!isActivated(context?.currentAppInstallation?.useCasesMetafield?.value)) {
    return 0;
  }

  let queued = 0;
  for (const checkout of context?.abandonedCheckouts?.nodes || []) {
    const age = now.getTime() - new Date(checkout.updatedAt).getTime();
    if (checkout.completedAt || age < 60 * 60_000 || age > 48 * 60 * 60_000) {
      continue;
    }
    const phoneNumber =
      checkout.customer?.phone ||
      checkout.shippingAddress?.phone ||
      checkout.billingAddress?.phone ||
      "";
    if (!phoneNumber) continue;

    const money = checkout.totalPriceSet?.shopMoney;
    const items = (checkout.lineItems?.nodes || [])
      .map(({ title, quantity }) =>
        title
          ? `${quantity && quantity > 1 ? `${quantity} × ` : ""}${title}`
          : "",
      )
      .filter(Boolean)
      .join(", ");
    try {
      const result = await enqueueUseCaseCall({
        shop,
        useCaseId: "abandoned_checkout",
        source: "shopify-scheduled",
        dedupeKey: `abandoned-checkout:${checkout.id}`,
        phoneNumber,
        metadata: {
          customer_name: checkout.customer?.firstName || "Valued customer",
          checkout_items: items,
          checkout_total: money?.amount || "",
          recovery_url: checkout.abandonedCheckoutUrl,
          checkout_context: money?.currencyCode
            ? `Currency: ${money.currencyCode}`
            : "",
        },
      });
      if (!result.duplicate) queued += 1;
    } catch (error) {
      console.error(
        `Could not enqueue abandoned checkout ${checkout.id} for ${shop}:`,
        error,
      );
    }
  }
  return queued;
}

export async function scheduleAbandonedCheckoutCalls(
  maxShops = 10,
): Promise<{ shops: number; queued: number; failed: number }> {
  const batchSize = Math.max(1, Math.min(maxShops, 50));
  const state = await db.schedulerState.findUnique({
    where: { name: "abandoned-checkout" },
  });
  const sessions = await db.session.findMany({
    distinct: ["shop"],
    where: state?.cursorShop ? { shop: { gt: state.cursorShop } } : undefined,
    take: batchSize,
    select: { shop: true },
    orderBy: { shop: "asc" },
  });
  let queued = 0;
  let failed = 0;
  const now = new Date();
  for (const { shop } of sessions) {
    try {
      queued += await scanShop(shop, now);
    } catch (error) {
      failed += 1;
      console.error(`Abandoned checkout scan failed for ${shop}:`, error);
    }
  }
  await db.schedulerState.upsert({
    where: { name: "abandoned-checkout" },
    create: {
      name: "abandoned-checkout",
      cursorShop:
        sessions.length === batchSize
          ? sessions[sessions.length - 1]?.shop
          : null,
    },
    update: {
      cursorShop:
        sessions.length === batchSize
          ? sessions[sessions.length - 1]?.shop
          : null,
    },
  });
  return { shops: sessions.length, queued, failed };
}
