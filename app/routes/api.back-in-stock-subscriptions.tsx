import type { ActionFunctionArgs } from "react-router";
import { automationWorkflowsEnabled } from "../services/automation-mode.server";
import {
  cancelStockAlert,
  subscribeToStockAlert,
} from "../services/back-in-stock.server";
import { hasValidBearerSecret } from "../services/bearer-auth.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (!hasValidBearerSecret(request, process.env.INTEGRATION_API_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!automationWorkflowsEnabled()) {
    return Response.json(
      { error: "Automatic workflows are not enabled for this release." },
      { status: 503 },
    );
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const operation = String(body.operation || "subscribe");
    if (operation === "unsubscribe") {
      const cancelled = await cancelStockAlert(
        String(body.shop || ""),
        String(body.dedupe_key || ""),
      );
      return Response.json({ cancelled }, { status: cancelled ? 200 : 404 });
    }
    const consentRecordedAt = new Date(String(body.consent_recorded_at || ""));
    const result = await subscribeToStockAlert({
      shop: String(body.shop || ""),
      inventoryItemId: String(body.inventory_item_id || ""),
      dedupeKey: String(body.dedupe_key || ""),
      phoneNumber: String(body.phone_number || ""),
      customerName: String(body.customer_name || ""),
      productName: String(body.product_name || ""),
      productUrl: String(body.product_url || ""),
      productVariant:
        typeof body.product_variant === "string"
          ? body.product_variant
          : undefined,
      productPrice:
        typeof body.product_price === "string" ? body.product_price : undefined,
      consentRecordedAt,
    });
    return Response.json(result, { status: result.duplicate ? 200 : 202 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
};
