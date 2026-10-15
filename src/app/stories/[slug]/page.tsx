import { notFound } from "next/navigation";

import { StoryLayout } from "@/components/StoryLayout";
import { TimelineView } from "@/components/TimelineView";
import { getDb } from "@/db/client";
import {
  getChildTimelines,
  getRootTimelineId,
  getStoryBySlug,
  getTimelineSummaries,
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

  // No preferred-path resolver yet; the root timeline is the default. Phase 4
  // replaces this with the rank-based walk from the root.
  const rootTimelineId = await getRootTimelineId(db, story.id);
  if (!rootTimelineId) notFound();

  const rendered = await renderTimeline(db, story.id, rootTimelineId);
  const [branches, history] = await Promise.all([
    getChildTimelines(db, story.id, rootTimelineId),
    getTimelineSummaries(db, story.id, rendered.pathTimelineIds),
  ]);

  return (
    <StoryLayout
      timelineId={rendered.timelineId}
      footer={<p>Seed version. Every accepted change creates a new timeline.</p>}
    >
      <TimelineView
        slug={slug}
        rendered={rendered}
        branches={branches}
        history={history}
      />
    </StoryLayout>
  );
}
