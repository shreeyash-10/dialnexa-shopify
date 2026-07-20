import { timingSafeEqual } from "node:crypto";

export function hasValidBearerSecret(
  request: Request,
  secret: string | undefined,
): boolean {
  const authorization = request.headers.get("authorization") || "";
  const expected = secret ? `Bearer ${secret}` : "";
  if (
    !secret ||
    secret.length < 32 ||
    authorization.length !== expected.length
  ) {
    return false;
  }
  return timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
}
