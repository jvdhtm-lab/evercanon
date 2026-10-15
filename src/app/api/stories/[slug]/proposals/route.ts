import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getDb } from "@/db/client";
import { TimelineNotFoundError, ValidationError } from "@/domain/errors";
import {
  MAX_EDIT_TEXT_LENGTH,
  proposeUnitReplacement,
  StaleEditError,
  TargetUnitNotFoundError,
} from "@/services/proposals";
import { getStoryBySlug } from "@/services/timeline";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  parentTimelineId: z.uuid(),
  targetUnitId: z.uuid(),
  selectedText: z.string().min(1).max(MAX_EDIT_TEXT_LENGTH),
  replacementText: z.string().min(1).max(MAX_EDIT_TEXT_LENGTH),
  requestKey: z.string().min(1).max(200).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_input",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      },
      { status: 422 },
    );
  }

  const db = getDb();
  const story = await getStoryBySlug(db, slug);
  if (!story) {
    return NextResponse.json({ error: "story_not_found" }, { status: 404 });
  }

  try {
    const result = await proposeUnitReplacement(db, {
      storyId: story.id,
      ...parsed.data,
    });
    return NextResponse.json(
      {
        timelineId: result.timelineId,
        created: result.created,
        url: `/stories/${slug}/t/${result.timelineId}`,
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof TimelineNotFoundError) {
      return NextResponse.json(
        { error: "parent_timeline_not_found" },
        { status: 404 },
      );
    }
    if (error instanceof StaleEditError) {
      return NextResponse.json(
        { error: "stale_edit", message: error.message },
        { status: 409 },
      );
    }
    if (error instanceof TargetUnitNotFoundError) {
      return NextResponse.json(
        { error: "target_unit_not_found", message: error.message },
        { status: 400 },
      );
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
