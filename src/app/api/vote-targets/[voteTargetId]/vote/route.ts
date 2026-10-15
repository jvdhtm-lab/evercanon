import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getDb } from "@/db/client";
import {
  RateLimitError,
  ValidationError,
  VoteTargetNotFoundError,
} from "@/domain/errors";
import {
  signVisitorId,
  verifyVisitorCookie,
  VISITOR_COOKIE_NAME,
} from "@/domain/visitor";
import { requireEnv } from "@/lib/config";
import { isSameOrigin } from "@/lib/requestGuard";
import { castVote } from "@/services/votes";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z.object({
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ voteTargetId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "cross_origin_rejected" }, { status: 403 });
  }

  const { voteTargetId } = await params;
  if (!UUID_RE.test(voteTargetId)) {
    return NextResponse.json({ error: "invalid_vote_target" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 422 });
  }

  const secret = requireEnv("VISITOR_COOKIE_SECRET");
  let visitorId = verifyVisitorCookie(
    secret,
    request.cookies.get(VISITOR_COOKIE_NAME)?.value,
  );
  const isNewVisitor = !visitorId;
  if (!visitorId) visitorId = randomUUID();

  const db = getDb();

  try {
    const result = await castVote(db, {
      voteTargetId,
      visitorId,
      value: parsed.data.value,
    });

    const response = NextResponse.json(result);
    if (isNewVisitor) {
      const forwardedProto = request.headers.get("x-forwarded-proto");
      const secure = forwardedProto
        ? forwardedProto.split(",")[0].trim() === "https"
        : new URL(request.url).protocol === "https:";
      response.cookies.set({
        name: VISITOR_COOKIE_NAME,
        value: signVisitorId(secret, visitorId),
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  } catch (error) {
    if (error instanceof VoteTargetNotFoundError) {
      return NextResponse.json({ error: error.code }, { status: 404 });
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.code }, { status: 429 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 422 },
      );
    }
    throw error;
  }
}
