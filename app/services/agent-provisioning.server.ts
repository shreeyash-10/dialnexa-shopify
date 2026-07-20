import { Prisma } from "@prisma/client";
import db from "../db.server";

const STALE_PROVISIONING_MINUTES = 2;

export interface ProvisioningClaim {
  provisioningId: string;
  existingAgentId?: string;
}

export async function claimAgentProvisioning(
  shop: string,
  useCaseId: string,
  templateVersion: number,
): Promise<ProvisioningClaim> {
  try {
    const created = await db.agentProvisioning.create({
      data: {
        shop,
        useCaseId,
        templateVersion,
        status: "processing",
      },
    });
    return { provisioningId: created.id };
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }
  }

  const existing = await db.agentProvisioning.findUniqueOrThrow({
    where: { shop_useCaseId: { shop, useCaseId } },
  });
  if (
    existing.status === "succeeded" &&
    existing.templateVersion === templateVersion &&
    existing.agentId
  ) {
    return {
      provisioningId: existing.id,
      existingAgentId: existing.agentId,
    };
  }

  const staleBefore = new Date(
    Date.now() - STALE_PROVISIONING_MINUTES * 60 * 1_000,
  );
  if (existing.status === "processing" && existing.updatedAt > staleBefore) {
    throw new Error(
      "Agent provisioning is already in progress. Try again shortly.",
    );
  }

  const claimed = await db.agentProvisioning.updateMany({
    where: { id: existing.id, updatedAt: existing.updatedAt },
    data: {
      templateVersion,
      status: "processing",
      agentId: null,
      error: null,
    },
  });
  if (claimed.count !== 1) {
    throw new Error("Agent provisioning was claimed by another request.");
  }

  return { provisioningId: existing.id };
}

export async function completeAgentProvisioning(
  provisioningId: string,
  agentId: string,
): Promise<void> {
  await db.agentProvisioning.update({
    where: { id: provisioningId },
    data: { status: "succeeded", agentId, error: null },
  });
}

export async function failAgentProvisioning(
  provisioningId: string,
  error: unknown,
): Promise<void> {
  const message =
    error instanceof Error ? error.message.slice(0, 1_000) : "Unknown error";
  await db.agentProvisioning.update({
    where: { id: provisioningId },
    data: { status: "failed", error: message },
  });
}
