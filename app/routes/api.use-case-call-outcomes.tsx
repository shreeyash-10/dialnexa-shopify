import type { ActionFunctionArgs } from "react-router";
import { hasValidBearerSecret } from "../services/bearer-auth.server";
import { recordCallOutcome } from "../services/call-outcomes.server";

interface OutcomeRequest {
  dialnexa_call_id?: unknown;
  resolved?: unknown;
  outcome?: unknown;
  needs_human_follow_up?: unknown;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  if (!hasValidBearerSecret(request, process.env.INTEGRATION_API_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as OutcomeRequest;
    if (
      typeof body.resolved !== "boolean" ||
      typeof body.needs_human_follow_up !== "boolean"
    ) {
      throw new Error(
        "resolved and needs_human_follow_up must both be booleans",
      );
    }
    const result = await recordCallOutcome({
      dialnexaCallId: String(body.dialnexa_call_id || ""),
      resolved: body.resolved,
      outcome: String(body.outcome || ""),
      needsHumanFollowUp: body.needs_human_follow_up,
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return Response.json(
      { error: message },
      { status: message === "Call was not found" ? 404 : 400 },
    );
  }
};
