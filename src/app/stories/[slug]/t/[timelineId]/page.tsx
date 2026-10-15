import Link from "next/link";
import { notFound } from "next/navigation";

import { StoryLayout } from "@/components/StoryLayout";
import { StoryText } from "@/components/StoryText";
import { getDb } from "@/db/client";
import { TimelineNotFoundError } from "@/domain/errors";
import { getStoryBySlug, renderTimeline } from "@/services/timeline";

export const dynamic = "force-dynamic";

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ slug: string; timelineId: string }>;
}) {
  const { slug, timelineId } = await params;
  const db = getDb();

  const story = await getStoryBySlug(db, slug);
  if (!story) notFound();

  let rendered;
  try {
    rendered = await renderTimeline(db, story.id, timelineId);
  } catch (error) {
    if (error instanceof TimelineNotFoundError) notFound();
    throw error;
  }

  return (
    <StoryLayout
      timelineId={rendered.timelineId}
      footer={
        <p>
          <Link
            className="underline hover:text-neutral-600"
            href={`/stories/${slug}`}
          >
            Back to the preferred version
          </Link>
        </p>
      }
    >
      <StoryText rendered={rendered} />
    </StoryLayout>
  );
}
