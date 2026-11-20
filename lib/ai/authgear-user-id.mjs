import { createHash } from "node:crypto";

/**
 * Stable RFC 4122 UUID v5 compatible with MAXWEB's existing
 * stableUserIdFromSubject() mapping. The issuer is required because callers
 * must pass the verified configured issuer, but it is intentionally not
 * included in the hash so existing Authgear-owned conversations keep the
 * same user_id across chat, intake, demo, and quote-status routes.
 */
export function authgearSubjectToUserId(issuer, subject) {
  const normalizedIssuer = typeof issuer === "string" ? issuer.trim() : "";
  const normalizedSubject = typeof subject === "string" ? subject.trim() : "";
  if (!normalizedIssuer || !normalizedSubject) {
    throw new TypeError("Authgear issuer and subject are required.");
  }

  const digest = createHash("sha1")
    .update("maxweb-authgear-v1:")
    .update(normalizedSubject)
    .digest();
  const bytes = Buffer.from(digest.subarray(0, 16));

  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
