import type { LoaderFunctionArgs } from "react-router";
import db from "../db.server";

const REQUIRED_ENVIRONMENT = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_APP_URL",
  "SCOPES",
  "DATABASE_URL",
  "CRON_SECRET",
  "PHONE_HASH_SECRET",
  "CALL_PAYLOAD_ENCRYPTION_KEY",
  "INTEGRATION_API_SECRET",
  "SUBSCRIPTION_PAYMENT_UPDATE_URL",
] as const;

function invalidEnvironment(): string[] {
  const invalid = [
    "CRON_SECRET",
    "PHONE_HASH_SECRET",
    "INTEGRATION_API_SECRET",
  ].filter(
    (name) =>
      Boolean(process.env[name]) && (process.env[name]?.length || 0) < 32,
  );
  const encryption = process.env.CALL_PAYLOAD_ENCRYPTION_KEY || "";
  if (encryption) {
    const bytes = /^[a-f\d]{64}$/i.test(encryption)
      ? Buffer.from(encryption, "hex")
      : Buffer.from(encryption, "base64");
    if (bytes.length !== 32) invalid.push("CALL_PAYLOAD_ENCRYPTION_KEY");
  }
  return invalid;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }
  const missing = REQUIRED_ENVIRONMENT.filter((name) => !process.env[name]);
  const invalid = invalidEnvironment();
  let database = false;
  try {
    await db.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }
  const ready = missing.length === 0 && invalid.length === 0 && database;
  return Response.json(
    {
      status: ready ? "ready" : "not_ready",
      database,
      configuration: missing.length === 0 && invalid.length === 0,
      ...(missing.length ? { missing } : {}),
      ...(invalid.length ? { invalid } : {}),
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
};
