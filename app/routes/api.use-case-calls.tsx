import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { hasValidBearerSecret } from "../services/bearer-auth.server";
import { enqueueUseCaseCall } from "../services/use-case-call-queue.server";
import {
  getRuntimeUseCase,
  RUNTIME_USE_CASE_IDS,
  type UseCaseTrigger,
} from "../services/use-case-runtime";

interface UseCaseCallRequest {
  shop?: unknown;
  use_case_id?: unknown;
  source?: unknown;
  dedupe_key?: unknown;
  phone_number?: unknown;
  metadata?: unknown;
  available_at?: unknown;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (!hasValidBearerSecret(request, process.env.INTEGRATION_API_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({
    use_cases: RUNTIME_USE_CASE_IDS.map((id) => getRuntimeUseCase(id)),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (!hasValidBearerSecret(request, process.env.INTEGRATION_API_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 64 * 1024) {
    return Response.json(
      { error: "Request body is too large" },
      { status: 413 },
    );
  }

  try {
    const body = (await request.json()) as UseCaseCallRequest;
    const metadata =
      body.metadata &&
      typeof body.metadata === "object" &&
      !Array.isArray(body.metadata)
        ? Object.fromEntries(
            Object.entries(body.metadata).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === "string",
            ),
          )
        : {};
    const availableAt =
      typeof body.available_at === "string"
        ? new Date(body.available_at)
        : undefined;
    if (availableAt && Number.isNaN(availableAt.getTime())) {
      throw new Error("available_at must be an ISO-8601 date-time");
    }

    const result = await enqueueUseCaseCall({
      shop: String(body.shop || ""),
      useCaseId: String(body.use_case_id || ""),
      source: String(body.source || "") as UseCaseTrigger,
      dedupeKey: String(body.dedupe_key || ""),
      phoneNumber: String(body.phone_number || ""),
      metadata,
      availableAt,
    });

    return Response.json(result, { status: result.duplicate ? 200 : 202 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
};
