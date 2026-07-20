import db from "../db.server";
import { getUseCase } from "./use-cases.server";

export interface CallOutcomeInput {
  dialnexaCallId: string;
  resolved: boolean;
  outcome: string;
  needsHumanFollowUp: boolean;
}

function validateOutcome(useCaseId: string, input: CallOutcomeInput): void {
  const useCase = getUseCase(useCaseId);
  if (!useCase) throw new Error(`Unknown use case: ${useCaseId}`);
  if (!Object.hasOwn(useCase.outcomeRules, input.outcome)) {
    throw new Error(`Invalid outcome for ${useCaseId}: ${input.outcome}`);
  }
  if (input.resolved && input.needsHumanFollowUp) {
    throw new Error("A resolved call cannot require human follow-up");
  }
  if (input.outcome === "do_not_call" && input.resolved) {
    throw new Error("A do_not_call outcome cannot be resolved");
  }
}

function isSameOutcome(
  existing: {
    resolved: boolean | null;
    outcome: string | null;
    needsHumanFollowUp: boolean | null;
  },
  input: CallOutcomeInput,
): boolean {
  return (
    existing.resolved === input.resolved &&
    existing.outcome === input.outcome &&
    existing.needsHumanFollowUp === input.needsHumanFollowUp
  );
}

export async function recordCallOutcome(input: CallOutcomeInput): Promise<{
  id: string;
  queue: "generic" | "order";
}> {
  if (!input.dialnexaCallId || input.dialnexaCallId.length > 200) {
    throw new Error("dialnexa_call_id must contain 1 to 200 characters");
  }

  const generic = await db.useCaseCall.findFirst({
    where: { dialnexaCallId: input.dialnexaCallId },
  });
  if (generic) {
    validateOutcome(generic.useCaseId, input);
    if (generic.outcome) {
      if (isSameOutcome(generic, input)) {
        return { id: generic.id, queue: "generic" };
      }
      throw new Error("A different outcome is already recorded for this call");
    }
    await db.$transaction(async (transaction) => {
      await transaction.useCaseCall.update({
        where: { id: generic.id },
        data: {
          resolved: input.resolved,
          outcome: input.outcome,
          needsHumanFollowUp: input.needsHumanFollowUp,
          completedAt: new Date(),
        },
      });
      if (input.outcome === "do_not_call" && generic.recipientHash) {
        await transaction.callSuppression.upsert({
          where: {
            shop_recipientHash: {
              shop: generic.shop,
              recipientHash: generic.recipientHash,
            },
          },
          create: {
            shop: generic.shop,
            recipientHash: generic.recipientHash,
            reason: "Customer requested do not call",
          },
          update: { reason: "Customer requested do not call" },
        });
      }
    });
    return { id: generic.id, queue: "generic" };
  }

  const order = await db.orderCall.findFirst({
    where: { dialnexaCallId: input.dialnexaCallId },
  });
  if (!order || !order.workflow) throw new Error("Call was not found");
  validateOutcome(order.workflow, input);
  if (order.outcome) {
    if (isSameOutcome(order, input)) {
      return { id: order.id, queue: "order" };
    }
    throw new Error("A different outcome is already recorded for this call");
  }
  await db.$transaction(async (transaction) => {
    await transaction.orderCall.update({
      where: { id: order.id },
      data: {
        resolved: input.resolved,
        outcome: input.outcome,
        needsHumanFollowUp: input.needsHumanFollowUp,
        completedAt: new Date(),
      },
    });
    if (input.outcome === "do_not_call" && order.recipientHash) {
      await transaction.callSuppression.upsert({
        where: {
          shop_recipientHash: {
            shop: order.shop,
            recipientHash: order.recipientHash,
          },
        },
        create: {
          shop: order.shop,
          recipientHash: order.recipientHash,
          reason: "Customer requested do not call",
        },
        update: { reason: "Customer requested do not call" },
      });
    }
  });
  return { id: order.id, queue: "order" };
}
