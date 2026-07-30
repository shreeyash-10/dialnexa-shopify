import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { automationWorkflowsEnabled } from "../services/automation-mode.server";
import { enqueueSubscriptionFailureCall } from "../services/shopify-event-calls.server";

interface BillingFailurePayload {
  subscription_contract_id?: number | string;
  admin_graphql_api_subscription_contract_id?: string;
  error_message?: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, webhookId } = await authenticate.webhook(request);
  if (!automationWorkflowsEnabled()) {
    return new Response(null, { status: 204 });
  }
  const event = payload as BillingFailurePayload;
  const contractId =
    event.admin_graphql_api_subscription_contract_id ||
    String(event.subscription_contract_id || "");
  if (!contractId) return new Response(null, { status: 204 });
  await enqueueSubscriptionFailureCall({
    shop,
    webhookId,
    contractId,
    errorMessage: event.error_message,
  });
  return new Response(null, { status: 204 });
};
