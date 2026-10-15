import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getDb } from "@/db/client";
import {
  RateLimitError,
  ValidationError,
  VoteTargetNotFoundError,
} from "@/domain/errors";
import { isSameOrigin } from "@/lib/requestGuard";
import { applyVisitorCookie, resolveVisitor } from "@/lib/visitorCookies";
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

  const visitor = resolveVisitor(request);
  const db = getDb();

  try {
    const result = await castVote(db, {
      voteTargetId,
      visitorId: visitor.visitorId,
      value: parsed.data.value,
    });
    const response = NextResponse.json(result);
    applyVisitorCookie(response, request, visitor);
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
