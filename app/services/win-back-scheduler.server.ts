import db from "../db.server";
import { unauthenticated } from "../shopify.server";
import { enqueueUseCaseCall } from "./use-case-call-queue.server";

interface WinBackConfiguration {
  enabled?: boolean;
  consentAttested?: boolean;
  agentId?: string;
  segmentQuery?: string;
  approvedOffer?: string;
  offerTerms?: string;
  offerUrl?: string;
  campaignIntervalDays?: number;
}

function parseConfiguration(value?: string): WinBackConfiguration | null {
  if (!value) return null;
  try {
    const all = JSON.parse(value) as Record<string, WinBackConfiguration>;
    const configuration = all.customer_win_back;
    return configuration?.enabled &&
      configuration.consentAttested &&
      configuration.agentId &&
      configuration.segmentQuery &&
      configuration.approvedOffer
      ? configuration
      : null;
  } catch {
    return null;
  }
}

async function scanShop(shop: string, now: Date): Promise<number> {
  const { admin } = await unauthenticated.admin(shop);
  const installationResponse = await admin.graphql(`
    #graphql
    query WinBackConfiguration {
      shop { ianaTimezone }
      currentAppInstallation {
        useCasesMetafield: metafield(namespace: "dialnexa", key: "use_cases") { value }
      }
    }
  `);
  const installationJson = (await installationResponse.json()) as {
    data?: {
      shop?: { ianaTimezone?: string };
      currentAppInstallation?: { useCasesMetafield?: { value?: string } };
    };
    errors?: Array<{ message?: string }>;
  };
  if (installationJson.errors?.length) {
    throw new Error(installationJson.errors[0]?.message || "Could not load win-back configuration");
  }
  const configuration = parseConfiguration(
    installationJson.data?.currentAppInstallation?.useCasesMetafield?.value,
  );
  if (!configuration) return 0;

  const response = await admin.graphql(
    `#graphql
    query WinBackMembers($query: String!, $timezone: String) {
      customerSegmentMembers(first: 50, query: $query, timezone: $timezone) {
        edges {
          node {
            id firstName displayName
            defaultPhoneNumber { phoneNumber }
          }
        }
      }
    }`,
    {
      variables: {
        query: configuration.segmentQuery,
        timezone: installationJson.data?.shop?.ianaTimezone || "UTC",
      },
    },
  );
  const json = (await response.json()) as {
    data?: {
      customerSegmentMembers?: {
        edges?: Array<{
          node: {
            id: string;
            firstName?: string | null;
            displayName: string;
            defaultPhoneNumber?: { phoneNumber?: string | null } | null;
          };
        }>;
      };
    };
    errors?: Array<{ message?: string }>;
  };
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || "Shopify segment query failed");
  }
  const intervalDays = Math.max(
    7,
    Math.min(configuration.campaignIntervalDays || 30, 365),
  );
  const bucket = Math.floor(now.getTime() / (intervalDays * 24 * 60 * 60_000));
  let queued = 0;
  for (const { node } of json.data?.customerSegmentMembers?.edges || []) {
    const phoneNumber = node.defaultPhoneNumber?.phoneNumber;
    if (!phoneNumber) continue;
    try {
      const result = await enqueueUseCaseCall({
        shop,
        useCaseId: "customer_win_back",
        source: "shopify-scheduled",
        dedupeKey: `win-back:${node.id}:${bucket}`,
        phoneNumber,
        metadata: {
          customer_name: node.firstName || node.displayName || "Valued customer",
          approved_offer: configuration.approvedOffer || "",
          ...(configuration.offerTerms ? { offer_terms: configuration.offerTerms } : {}),
          ...(configuration.offerUrl ? { offer_url: configuration.offerUrl } : {}),
        },
      });
      if (!result.duplicate) queued += 1;
    } catch (error) {
      console.error(`Could not enqueue win-back member ${node.id} for ${shop}:`, error);
    }
  }
  return queued;
}

export async function scheduleWinBackCalls(
  maxShops = 10,
): Promise<{ shops: number; queued: number; failed: number }> {
  const sessions = await db.session.findMany({
    distinct: ["shop"],
    take: Math.max(1, Math.min(maxShops, 50)),
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
      console.error(`Win-back scan failed for ${shop}:`, error);
    }
  }
  return { shops: sessions.length, queued, failed };
}
