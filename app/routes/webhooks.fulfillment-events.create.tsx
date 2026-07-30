import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { automationWorkflowsEnabled } from "../services/automation-mode.server";
import { enqueueOrderEventCall } from "../services/shopify-event-calls.server";
import { fulfillmentWorkflowForStatus } from "../services/shopify-event-routing";

interface FulfillmentEventPayload {
  id?: number | string;
  order_id?: number | string;
  status?: string;
  message?: string | null;
  estimated_delivery_at?: string | null;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, webhookId } = await authenticate.webhook(request);
  if (!automationWorkflowsEnabled()) {
    return new Response(null, { status: 204 });
  }
  const event = payload as FulfillmentEventPayload;
  if (!event.order_id || !event.status)
    return new Response(null, { status: 204 });
  const status = event.status.toLowerCase();
  const workflow = fulfillmentWorkflowForStatus(status);
  if (workflow === "failed_delivery") {
    await enqueueOrderEventCall({
      shop,
      webhookId,
      orderId: event.order_id,
      useCaseId: "failed_delivery",
      source: "fulfillment_events/create",
      eventMetadata: {
        delivery_failure_reason: event.message || status.replaceAll("_", " "),
        reattempt_options:
          "A delivery team member must confirm any requested reattempt",
      },
    });
  } else if (workflow === "shipping_delay") {
    await enqueueOrderEventCall({
      shop,
      webhookId,
      orderId: event.order_id,
      useCaseId: "shipping_delay",
      source: "fulfillment_events/create",
      eventMetadata: {
        shipping_status: "The carrier reported a shipping delay",
        delay_reason: event.message || "No carrier reason was supplied",
        approved_next_step: event.estimated_delivery_at
          ? `Current estimated delivery: ${event.estimated_delivery_at}`
          : "Monitor tracking for the next carrier update",
      },
    });
  } else if (workflow === "delivery_feedback") {
    await enqueueOrderEventCall({
      shop,
      webhookId,
      orderId: event.order_id,
      useCaseId: "delivery_feedback",
      source: "fulfillment_events/create",
      delayMinutes: 24 * 60,
      eventMetadata: {
        support_route:
          "Request human follow-up for any delivery or product issue",
      },
    });
  }
  return new Response(null, { status: 204 });
};
