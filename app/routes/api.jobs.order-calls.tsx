import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { scheduleAbandonedCheckoutCalls } from "../services/abandoned-checkout-scheduler.server";
import { automationWorkflowsEnabled } from "../services/automation-mode.server";
import { hasValidBearerSecret } from "../services/bearer-auth.server";
import { processOrderCallQueue } from "../services/order-call-queue.server";
import { processUseCaseCallQueue } from "../services/use-case-call-queue.server";
import { scheduleWinBackCalls } from "../services/win-back-scheduler.server";

async function runWorker(request: Request): Promise<Response> {
  if (!automationWorkflowsEnabled()) {
    return Response.json(
      {
        status: "disabled",
        message: "Automatic workflows are not enabled for this release.",
      },
      { status: 503 },
    );
  }

  if (!hasValidBearerSecret(request, process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [abandonedCheckouts, winBack] = await Promise.all([
    scheduleAbandonedCheckoutCalls(),
    scheduleWinBackCalls(),
  ]);
  const [orders, useCases] = await Promise.all([
    processOrderCallQueue(),
    processUseCaseCallQueue(),
  ]);
  return Response.json({
    processed: orders.processed + useCases.processed,
    orders: orders.processed,
    useCases: useCases.processed,
    scheduled: { abandonedCheckouts, winBack },
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) =>
  runWorker(request);

export const action = async ({ request }: ActionFunctionArgs) =>
  runWorker(request);
