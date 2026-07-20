import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { enqueueOrderEventCall } from "../services/shopify-event-calls.server";
import { isHighRiskAssessment } from "../services/shopify-event-routing";

interface RiskAssessmentPayload {
  order_id?: number | string;
  risk_level?: string;
  facts?: Array<{ description?: string }>;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, webhookId } = await authenticate.webhook(request);
  const event = payload as RiskAssessmentPayload;
  if (!event.order_id || !isHighRiskAssessment(event.risk_level)) {
    return new Response(null, { status: 204 });
  }
  await enqueueOrderEventCall({
    shop, webhookId, orderId: event.order_id,
    useCaseId: "high_risk_verification",
    source: "orders/risk_assessment_changed",
    eventMetadata: {
      order_context:
        event.facts?.map(({ description }) => description).filter(Boolean).join("; ") ||
        "Shopify reported a high risk assessment",
    },
  });
  return new Response(null, { status: 204 });
};
