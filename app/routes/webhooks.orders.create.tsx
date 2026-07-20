import { Prisma } from "@prisma/client";
import type { ActionFunctionArgs } from "react-router";
import db from "../db.server";
import { authenticate } from "../shopify.server";

interface OrderCreatedPayload {
  id?: number | string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, webhookId } = await authenticate.webhook(request);
  const orderId = String((payload as OrderCreatedPayload).id || "");

  if (!orderId) {
    console.warn(
      `Ignoring orders/create webhook without an order ID for ${shop}`,
    );
    return new Response(null, { status: 204 });
  }

  try {
    await db.orderCall.create({
      data: {
        shop,
        orderId,
        webhookId,
        status: "queued",
        attempts: 0,
      },
    });
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }

    console.info(
      `Ignoring duplicate orders/create webhook for order ${orderId}`,
    );
  }

  return new Response(null, { status: 204 });
};
