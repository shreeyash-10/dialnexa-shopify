import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptCallPayload,
  encryptCallPayload,
} from "./call-payload-crypto.server";

describe("encrypted call payloads", () => {
  const previousKey = process.env.CALL_PAYLOAD_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.CALL_PAYLOAD_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      "base64",
    );
  });

  afterEach(() => {
    process.env.CALL_PAYLOAD_ENCRYPTION_KEY = previousKey;
  });

  it("round-trips phone and metadata without plaintext storage", () => {
    const encrypted = encryptCallPayload({
      phoneNumber: "+919876543210",
      metadata: { customer_name: "Ada", order_number: "#1001" },
    });

    expect(encrypted).not.toContain("Ada");
    expect(encrypted).not.toContain("9876543210");
    expect(decryptCallPayload(encrypted)).toEqual({
      phoneNumber: "+919876543210",
      metadata: { customer_name: "Ada", order_number: "#1001" },
    });
  });

  it("rejects a missing or malformed key", () => {
    process.env.CALL_PAYLOAD_ENCRYPTION_KEY = "short";
    expect(() =>
      encryptCallPayload({ phoneNumber: "+919876543210", metadata: {} }),
    ).toThrow(/32-byte/);
  });
});
