import { randomUUID } from "node:crypto";

import type { NextRequest, NextResponse } from "next/server";

import {
  signVisitorId,
  verifyVisitorCookie,
  VISITOR_COOKIE_NAME,
} from "@/domain/visitor";
import { requireEnv } from "@/lib/config";

export interface ResolvedVisitor {
  secret: string;
  visitorId: string;
  isNew: boolean;
}

/** Reads the signed visitor cookie, generating a fresh identity if absent. */
export function resolveVisitor(request: NextRequest): ResolvedVisitor {
  const secret = requireEnv("VISITOR_COOKIE_SECRET");
  const existing = verifyVisitorCookie(
    secret,
    request.cookies.get(VISITOR_COOKIE_NAME)?.value,
  );
  return {
    secret,
    visitorId: existing ?? randomUUID(),
    isNew: existing === null,
  };
}

/** Sets the visitor cookie. `Secure` follows the request's effective protocol. */
export function applyVisitorCookie(
  response: NextResponse,
  request: NextRequest,
  visitor: ResolvedVisitor,
): void {
  if (!visitor.isNew) return;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const secure = forwardedProto
    ? forwardedProto.split(",")[0].trim() === "https"
    : new URL(request.url).protocol === "https:";

  response.cookies.set({
    name: VISITOR_COOKIE_NAME,
    value: signVisitorId(visitor.secret, visitor.visitorId),
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
