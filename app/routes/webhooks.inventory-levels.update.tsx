import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { automationWorkflowsEnabled } from "../services/automation-mode.server";
import { processInventoryAvailability } from "../services/back-in-stock.server";

interface InventoryLevelPayload {
  inventory_item_id?: number | string;
  available?: number;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, webhookId } = await authenticate.webhook(request);
  if (!automationWorkflowsEnabled()) {
    return new Response(null, { status: 204 });
  }
  const event = payload as InventoryLevelPayload;
  if (!event.inventory_item_id || typeof event.available !== "number") {
    return new Response(null, { status: 204 });
  }
  await processInventoryAvailability({
    shop,
    webhookId,
    inventoryItemId: event.inventory_item_id,
    available: event.available,
  });
  return new Response(null, { status: 204 });
};
