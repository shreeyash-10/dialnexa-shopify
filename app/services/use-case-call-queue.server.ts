import { createHmac } from "node:crypto";
import { Prisma, type UseCaseCall } from "@prisma/client";
import db from "../db.server";
import { unauthenticated } from "../shopify.server";
import {
  decryptCallPayload,
  encryptCallPayload,
} from "./call-payload-crypto.server";
import {
  DialnexaApiError,
  normalizePhoneNumber,
  triggerOutboundCall,
} from "./dialnexa.server";
import {
  getRuntimeUseCase,
  isInQuietHours,
  validateCallMetadata,
  type ActivatedRuntimeUseCase,
  type UseCaseTrigger,
} from "./use-case-runtime";

const MAX_ATTEMPTS = 5;
const STALE_LOCK_MINUTES = 5;
const SHOP_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

interface EnqueueUseCaseCallInput {
  shop: string;
  useCaseId: string;
  source: UseCaseTrigger;
  dedupeKey: string;
  phoneNumber: string;
  metadata: Record<string, string>;
  availableAt?: Date;
}

interface InstallationContext {
  shop?: { ianaTimezone?: string };
  currentAppInstallation?: {
    apiKeyMetafield?: { value?: string };
    useCasesMetafield?: { value?: string };
  };
}

function parseUseCases(
  value?: string,
): Record<string, ActivatedRuntimeUseCase> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function hashRecipient(shop: string, phoneNumber: string): string {
  const secret = process.env.PHONE_HASH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("PHONE_HASH_SECRET must contain at least 32 characters");
  }
  return createHmac("sha256", secret)
    .update(`${shop}:${phoneNumber}`)
    .digest("hex");
}

export async function enqueueUseCaseCall(
  input: EnqueueUseCaseCallInput,
): Promise<{ id: string; duplicate: boolean }> {
  if (!SHOP_PATTERN.test(input.shop)) throw new Error("Invalid Shopify domain");
  if (!input.dedupeKey || input.dedupeKey.length > 200) {
    throw new Error("dedupeKey must contain 1 to 200 characters");
  }

  const definition = getRuntimeUseCase(input.useCaseId);
  if (!definition) throw new Error(`Unknown use case: ${input.useCaseId}`);
  if (!definition.triggers.includes(input.source)) {
    throw new Error(`${input.source} cannot trigger ${input.useCaseId}`);
  }

  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  if (!phoneNumber) throw new Error("phoneNumber must be valid E.164");
  const metadataErrors = validateCallMetadata(input.useCaseId, input.metadata);
  if (metadataErrors.length) throw new Error(metadataErrors.join("; "));

  const stringMetadata = Object.fromEntries(
    Object.entries(input.metadata)
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => [key.slice(0, 100), value.slice(0, 2_000)]),
  );
  const encryptedPayload = encryptCallPayload({
    phoneNumber,
    metadata: stringMetadata,
  });

  try {
    const job = await db.useCaseCall.create({
      data: {
        shop: input.shop,
        useCaseId: input.useCaseId,
        source: input.source,
        dedupeKey: input.dedupeKey,
        encryptedPayload,
        availableAt: input.availableAt || new Date(),
      },
      select: { id: true },
    });
    return { id: job.id, duplicate: false };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await db.useCaseCall.findUniqueOrThrow({
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

async function claimNext(): Promise<UseCaseCall | null> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MINUTES * 60_000);
  const candidate = await db.useCaseCall.findFirst({
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

  const claimed = await db.useCaseCall.updateMany({
    where: {
      id: candidate.id,
      status: candidate.status,
      updatedAt: candidate.updatedAt,
    },
    data: {
      status: "processing",
      attempts: { increment: 1 },
      lockedAt: now,
      error: null,
    },
  });
  if (claimed.count !== 1) return null;
  return {
    ...candidate,
    status: "processing",
    attempts: candidate.attempts + 1,
    lockedAt: now,
    error: null,
  };
}

async function loadInstallation(shop: string): Promise<InstallationContext> {
  const { admin } = await unauthenticated.admin(shop);
  const response = await admin.graphql(`
    #graphql
    query GenericUseCaseCallContext {
      shop { ianaTimezone }
      currentAppInstallation {
        apiKeyMetafield: metafield(namespace: "dialnexa", key: "api_key") { value }
        useCasesMetafield: metafield(namespace: "dialnexa", key: "use_cases") { value }
      }
    }
  `);
  const json = (await response.json()) as {
    data?: InstallationContext;
    errors?: Array<{ message?: string }>;
  };
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || "Shopify context query failed");
  }
  return json.data || {};
}

async function skip(job: UseCaseCall, reason: string): Promise<void> {
  await db.useCaseCall.update({
    where: { id: job.id },
    data: {
      status: "skipped",
      error: reason.slice(0, 1_000),
      encryptedPayload: null,
      lockedAt: null,
      completedAt: new Date(),
    },
  });
}

async function defer(job: UseCaseCall): Promise<void> {
  await db.useCaseCall.update({
    where: { id: job.id },
    data: {
      status: "queued",
      attempts: { decrement: 1 },
      availableAt: new Date(Date.now() + 30 * 60_000),
      lockedAt: null,
      error: "Deferred during configured quiet hours",
    },
  });
}

async function processJob(job: UseCaseCall): Promise<void> {
  if (!job.encryptedPayload) {
    await skip(job, "Encrypted call payload is unavailable");
    return;
  }
  const payload = decryptCallPayload(job.encryptedPayload);
  const context = await loadInstallation(job.shop);
  const apiKey = context.currentAppInstallation?.apiKeyMetafield?.value;
  const activated = parseUseCases(
    context.currentAppInstallation?.useCasesMetafield?.value,
  );
  const configuration = activated[job.useCaseId];

  if (!apiKey || !configuration?.enabled || !configuration.agentId) {
    await skip(
      job,
      !apiKey ? "Dialnexa API key is missing" : "Use case is not active",
    );
    return;
  }
  if (!configuration.consentAttested) {
    await skip(job, "Merchant consent attestation is missing");
    return;
  }

  if (
    isInQuietHours(
      new Date(),
      context.shop?.ianaTimezone || "UTC",
      configuration.quietHoursStart || "20:00",
      configuration.quietHoursEnd || "09:00",
    )
  ) {
    await defer(job);
    return;
  }

  const recipientHash = hashRecipient(job.shop, payload.phoneNumber);
  const suppressed = await db.callSuppression.findUnique({
    where: { shop_recipientHash: { shop: job.shop, recipientHash } },
  });
  if (suppressed) {
    await skip(job, `Recipient suppressed: ${suppressed.reason}`);
    return;
  }

  const cap = Math.max(1, Math.min(configuration.maxCallsPer24Hours || 1, 3));
  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const [genericCalls, orderCalls] = await Promise.all([
    db.useCaseCall.count({
      where: {
        id: { not: job.id },
        shop: job.shop,
        recipientHash,
        status: "succeeded",
        createdAt: { gte: since },
      },
    }),
    db.orderCall.count({
      where: {
        shop: job.shop,
        recipientHash,
        status: "succeeded",
        createdAt: { gte: since },
      },
    }),
  ]);
  if (genericCalls + orderCalls >= cap) {
    await skip(job, "Recipient frequency cap reached for the last 24 hours");
    return;
  }

  await db.useCaseCall.update({
    where: { id: job.id },
    data: { recipientHash },
  });
  const result = await triggerOutboundCall(
    apiKey,
    configuration.agentId,
    payload.phoneNumber,
    {
      ...payload.metadata,
      shop: job.shop,
      use_case_id: job.useCaseId,
      use_case_call_id: job.id,
    },
  );
  const dialnexaCallId =
    result.id || result.call_id || result.data?.id || result.data?.call_id;

  await db.useCaseCall.update({
    where: { id: job.id },
    data: {
      status: "succeeded",
      dialnexaCallId,
      encryptedPayload: null,
      lockedAt: null,
      completedAt: new Date(),
      error: null,
    },
  });
}

async function fail(job: UseCaseCall, error: unknown): Promise<void> {
  const message =
    error instanceof Error ? error.message.slice(0, 1_000) : "Unknown error";
  const permanent = error instanceof DialnexaApiError && error.status < 500;
  const dead = permanent || job.attempts >= MAX_ATTEMPTS;
  await db.useCaseCall.update({
    where: { id: job.id },
    data: {
      status: dead ? "dead" : "failed",
      error: message,
      lockedAt: null,
      availableAt: new Date(
        Date.now() + Math.min(2 ** job.attempts, 60) * 60_000,
      ),
      ...(dead ? { encryptedPayload: null, completedAt: new Date() } : {}),
    },
  });
  console.error(
    `Use-case call job ${job.id} ${dead ? "died" : "failed"}: ${message}`,
  );
}

export async function processUseCaseCallQueue(
  maxJobs = 3,
): Promise<{ processed: number }> {
  let processed = 0;
  while (processed < Math.max(1, Math.min(maxJobs, 20))) {
    const job = await claimNext();
    if (!job) break;
    try {
      await processJob(job);
    } catch (error) {
      await fail(job, error);
    }
    processed += 1;
  }
  return { processed };
}
