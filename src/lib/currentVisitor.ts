import { cookies } from "next/headers";

import { VISITOR_COOKIE_NAME, verifyVisitorCookie } from "@/domain/visitor";

/**
 * Reads and verifies the visitor cookie in a server component. Returns null
 * when no valid cookie is present; the cookie itself is only created when the
 * visitor first votes (in the vote route handler).
 */
export async function getCurrentVisitorId(): Promise<string | null> {
  const secret = process.env.VISITOR_COOKIE_SECRET;
  if (!secret) return null;
  const store = await cookies();
  return verifyVisitorCookie(secret, store.get(VISITOR_COOKIE_NAME)?.value);
}
