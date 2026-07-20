import type { ActionFunctionArgs } from "react-router";
import db from "../db.server";
import { authenticate } from "../shopify.server";

interface CustomerRedactPayload {
  shop_domain?: string;
  orders_to_redact?: Array<number | string>;
}

interface ShopRedactPayload {
  shop_domain?: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  switch (topic) {
    case "CUSTOMERS_REDACT": {
      const { orders_to_redact: orderIds = [] } =
        payload as CustomerRedactPayload;
      await db.orderCall.deleteMany({
        where: {
          shop,
          orderId: { in: orderIds.map(String) },
        },
      });
      // Generic integrations deliberately avoid storing raw customer IDs. Remove
      // all encrypted pending payloads and suppression hashes for the shop so a
      // customer-redaction request can never leave unidentifiable customer data.
      await db.$transaction([
        db.useCaseCall.deleteMany({ where: { shop } }),
        db.callSuppression.deleteMany({ where: { shop } }),
        db.stockAlertSubscription.deleteMany({ where: { shop } }),
      ]);
      break;
    }
    case "SHOP_REDACT": {
      const redactedShop = (payload as ShopRedactPayload).shop_domain || shop;
      await db.$transaction([
        db.callSuppression.deleteMany({ where: { shop: redactedShop } }),
        db.useCaseCall.deleteMany({ where: { shop: redactedShop } }),
        db.agentProvisioning.deleteMany({ where: { shop: redactedShop } }),
        db.stockAlertSubscription.deleteMany({ where: { shop: redactedShop } }),
        db.orderCall.deleteMany({ where: { shop: redactedShop } }),
        db.session.deleteMany({ where: { shop: redactedShop } }),
      ]);
      break;
    }
    case "CUSTOMERS_DATA_REQUEST":
      // OrderCall records contain only Shopify resource IDs and operational status.
      // Generic pending payloads are encrypted and are deleted on redaction.
      break;
    default:
      console.warn(`Received unexpected compliance topic ${topic} for ${shop}`);
  }

  return new Response(null, { status: 204 });
};
