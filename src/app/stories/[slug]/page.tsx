import { notFound } from "next/navigation";

import { Branches } from "@/components/Branches";
import { History } from "@/components/History";
import { PreferredReading } from "@/components/PreferredReading";
import { ProposeUnitForm } from "@/components/ProposeUnitForm";
import { StoryLayout } from "@/components/StoryLayout";
import { getDb } from "@/db/client";
import { getCurrentVisitorId } from "@/lib/currentVisitor";
import { getPreferredView } from "@/services/preferred";
import {
  getBranchOptions,
  getStoryBySlug,
  getTimelineSummaries,
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

  const visitorId = await getCurrentVisitorId();
  const view = await getPreferredView(db, story.id, visitorId);
  if (!view) notFound();

  const leafTimelineId = view.rendered.timelineId;
  const [branches, history] = await Promise.all([
    getBranchOptions(db, story.id, leafTimelineId, visitorId),
    getTimelineSummaries(db, story.id, view.preferred.path),
  ]);

  return (
    <StoryLayout
      timelineId={leafTimelineId}
      footer={
        <p>
          This version is currently preferred. Every version remains part of
          the history.
        </p>
      }
    >
      <div className="space-y-10">
        <PreferredReading slug={slug} view={view} />

        <section aria-labelledby="propose-heading" className="space-y-3">
          <h2
            id="propose-heading"
            className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
          >
            Propose a change
          </h2>
          <div className="space-y-2">
            {view.units.map((unit) => (
              <ProposeUnitForm
                key={unit.unitId}
                slug={slug}
                parentTimelineId={leafTimelineId}
                unitId={unit.unitId}
                currentText={unit.text}
              />
            ))}
          </div>
        </section>

        <Branches slug={slug} branches={branches} />
        <History slug={slug} history={history} />
      </div>
    </StoryLayout>
  );
}
