import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getDb } from "@/db/client";
import {
  RateLimitError,
  TimelineNotFoundError,
  ValidationError,
} from "@/domain/errors";
import { isSameOrigin } from "@/lib/requestGuard";
import { applyVisitorCookie, resolveVisitor } from "@/lib/visitorCookies";
import { resolveSentenceTarget, resolveSpanTarget } from "@/services/targets";
import { getStoryBySlug } from "@/services/timeline";
import { castVote } from "@/services/votes";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const voteValue = z.union([z.literal(-1), z.literal(0), z.literal(1)]);

const bodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sentence"), unitId: z.uuid(), value: voteValue }),
  z.object({
    kind: z.literal("span"),
    unitId: z.uuid(),
    startOffset: z.number().int().min(0),
    endOffset: z.number().int().min(0),
    value: voteValue,
  }),
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; timelineId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "cross_origin_rejected" }, { status: 403 });
  }

  const { slug, timelineId } = await params;
  if (!UUID_RE.test(timelineId)) {
    return NextResponse.json({ error: "invalid_timeline" }, { status: 400 });
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

  const db = getDb();
  const story = await getStoryBySlug(db, slug);
  if (!story) {
    return NextResponse.json({ error: "story_not_found" }, { status: 404 });
  }

  const visitor = resolveVisitor(request);

  try {
    const target =
      parsed.data.kind === "sentence"
        ? await resolveSentenceTarget(db, {
            storyId: story.id,
            timelineId,
            unitId: parsed.data.unitId,
          })
        : await resolveSpanTarget(db, {
            storyId: story.id,
            timelineId,
            unitId: parsed.data.unitId,
            startOffset: parsed.data.startOffset,
            endOffset: parsed.data.endOffset,
          });

    const result = await castVote(db, {
      voteTargetId: target.id,
      visitorId: visitor.visitorId,
      value: parsed.data.value,
    });

    const response = NextResponse.json({
      ...result,
      targetId: target.id,
      targetKind: target.kind,
      targetText: target.text,
    });
    applyVisitorCookie(response, request, visitor);
    return response;
  } catch (error) {
    if (error instanceof TimelineNotFoundError) {
      return NextResponse.json({ error: "timeline_not_found" }, { status: 404 });
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
