import { Branches } from "@/components/Branches";
import { History } from "@/components/History";
import { ProposeUnitForm } from "@/components/ProposeUnitForm";
import { SelectableUnit } from "@/components/SelectableUnit";
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
      <article data-testid="story-text" className="space-y-6">
        {rendered.units.map((unit) => (
          <div key={unit.unitId} className="space-y-2">
            <p>
              <SelectableUnit
                slug={slug}
                timelineId={rendered.timelineId}
                unitId={unit.unitId}
                text={unit.text}
              />
            </p>
            <ProposeUnitForm
              slug={slug}
              parentTimelineId={rendered.timelineId}
              unitId={unit.unitId}
              currentText={unit.text}
            />
          </div>
        ))}
      </article>

      <Branches slug={slug} branches={branches} />
      <History slug={slug} history={history} />
    </div>
  );
}
