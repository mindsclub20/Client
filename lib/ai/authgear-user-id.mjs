import { createHash } from "node:crypto";

const UUID_NAMESPACE = Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex");

/**
 * Stable RFC 4122 UUID v5 for an Authgear identity.
 * ai_conversations.user_id is UUID, while Authgear subjects are opaque strings.
 */
export function authgearSubjectToUserId(issuer, subject) {
  const normalizedIssuer = typeof issuer === "string" ? issuer.trim() : "";
  const normalizedSubject = typeof subject === "string" ? subject.trim() : "";
  if (!normalizedIssuer || !normalizedSubject) {
    throw new TypeError("Authgear issuer and subject are required.");
  }

  const digest = createHash("sha1")
    .update(UUID_NAMESPACE)
    .update(`${normalizedIssuer}\u0000${normalizedSubject}`, "utf8")
    .digest();

  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;

  const hex = digest.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
