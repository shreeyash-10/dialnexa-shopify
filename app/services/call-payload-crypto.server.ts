import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

interface EncryptedCallPayload {
  phoneNumber: string;
  metadata: Record<string, string>;
}

function encryptionKey(): Buffer {
  const configured = process.env.CALL_PAYLOAD_ENCRYPTION_KEY || "";
  const key = /^[a-f\d]{64}$/i.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64");

  if (key.length !== 32) {
    throw new Error(
      "CALL_PAYLOAD_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex key",
    );
  }
  return key;
}

export function encryptCallPayload(payload: EncryptedCallPayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptCallPayload(value: string): EncryptedCallPayload {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Invalid encrypted call payload");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const payload = JSON.parse(plaintext) as EncryptedCallPayload;

  if (
    typeof payload.phoneNumber !== "string" ||
    !payload.metadata ||
    typeof payload.metadata !== "object"
  ) {
    throw new Error("Invalid decrypted call payload");
  }
  return payload;
}
