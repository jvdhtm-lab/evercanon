import { notFound } from "next/navigation";

import { StoryLayout } from "@/components/StoryLayout";
import { StoryText } from "@/components/StoryText";
import { getDb } from "@/db/client";
import {
  getRootTimelineId,
  getStoryBySlug,
  renderTimeline,
} from "@/services/timeline";

export const dynamic = "force-dynamic";

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = getDb();

  const story = await getStoryBySlug(db, slug);
  if (!story) notFound();

  // No branches exist yet, so the root timeline is the default reading path.
  // Phase 4 replaces this with the preferred-path resolver.
  const rootTimelineId = await getRootTimelineId(db, story.id);
  if (!rootTimelineId) notFound();

  const rendered = await renderTimeline(db, story.id, rootTimelineId);

  return (
    <StoryLayout
      timelineId={rendered.timelineId}
      footer={<p>Seed version. Every accepted change will create a new timeline.</p>}
    >
      <StoryText rendered={rendered} />
    </StoryLayout>
  );
}
