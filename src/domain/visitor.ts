import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Pseudonymous anonymous identity. A random UUID is stored in a signed cookie.
 * This is a lightweight duplicate-vote guard, NOT proof of one human per vote,
 * and is never derived from an IP address.
 */
export const VISITOR_COOKIE_NAME = "evercanon_visitor";
const VERSION = "v1";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Encodes `<version>.<uuid>.<hmac>` for the visitor cookie value. */
export function signVisitorId(secret: string, visitorId: string): string {
  if (!UUID_RE.test(visitorId)) {
    throw new Error("signVisitorId requires a UUID visitor id");
  }
  const payload = `${VERSION}.${visitorId}`;
  return `${payload}.${sign(secret, payload)}`;
}

/** Returns the visitor UUID if the cookie is authentic, otherwise null. */
export function verifyVisitorCookie(
  secret: string,
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [version, visitorId, signature] = parts;
  if (version !== VERSION) return null;
  if (!UUID_RE.test(visitorId)) return null;
  const expected = sign(secret, `${version}.${visitorId}`);
  return safeEqual(signature, expected) ? visitorId : null;
}
