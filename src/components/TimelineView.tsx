import { Branches } from "@/components/Branches";
import { History } from "@/components/History";
import { ProposeUnitForm } from "@/components/ProposeUnitForm";
import { StoryText } from "@/components/StoryText";
import type { RenderedTimeline } from "@/domain/render";
import type { BranchOption, TimelineSummary } from "@/services/timeline";

export function TimelineView({
  slug,
  rendered,
  branches,
  history,
}: {
  slug: string;
  rendered: RenderedTimeline;
  branches: BranchOption[];
  history: TimelineSummary[];
}) {
  return (
    <div className="space-y-10">
      <StoryText rendered={rendered} />

      <section aria-labelledby="propose-heading" className="space-y-3">
        <h2
          id="propose-heading"
          className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
        >
          Propose a change
        </h2>
        <div className="space-y-2">
          {rendered.units.map((unit) => (
            <ProposeUnitForm
              key={unit.unitId}
              slug={slug}
              parentTimelineId={rendered.timelineId}
              unitId={unit.unitId}
              currentText={unit.text}
            />
          ))}
        </div>
      </section>

      <Branches slug={slug} branches={branches} />
      <History slug={slug} history={history} />
    </div>
  );
}
