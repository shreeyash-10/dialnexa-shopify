import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { triggerOutboundCall } from "../services/dialnexa.server";

const APP_METAFIELD_NAMESPACE = "dialnexa";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, shop, payload, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const order = payload as any;

  // Get Dialnexa Config from Shopify Metafields
  const response = await admin!.graphql(`
    #graphql
    query {
      currentAppInstallation {
        apiKeyMetafield: metafield(namespace: "${APP_METAFIELD_NAMESPACE}", key: "api_key") {
          value
        }
        agentIdMetafield: metafield(namespace: "${APP_METAFIELD_NAMESPACE}", key: "agent_id") {
          value
        }
      }
    }
  `);

  const { data } = await response.json();
  const apiKey = data?.currentAppInstallation?.apiKeyMetafield?.value;
  const agentId = data?.currentAppInstallation?.agentIdMetafield?.value;
  
  if (!apiKey || !agentId) {
    console.log("No Dialnexa configuration found or missing API Key / Agent ID.");
    return new Response();
  }

  // Get customer phone number
  const phoneNumber = order.customer?.phone || order.shipping_address?.phone || order.billing_address?.phone;

  if (!phoneNumber) {
    console.log("No phone number found for order:", order.id);
    return new Response();
  }

  try {
    const variables = {
      customerName: order.customer?.first_name || "Valued Customer",
      orderNumber: order.name,
      totalPrice: order.total_price
    };

    console.log(`Triggering Dialnexa call for ${shop}, Order: ${order.name} to ${phoneNumber}`);
    await triggerOutboundCall(apiKey, agentId, phoneNumber, variables);
  } catch (error) {
    console.error("Failed to trigger Dialnexa call:", error);
  }

  return new Response();
};
