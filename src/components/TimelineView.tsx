import Link from "next/link";

import { ProposeUnitForm } from "@/components/ProposeUnitForm";
import { StoryText } from "@/components/StoryText";
import type { RenderedTimeline } from "@/domain/render";
import type { ChildTimeline, TimelineSummary } from "@/services/timeline";

export function TimelineView({
  slug,
  rendered,
  branches,
  history,
}: {
  slug: string;
  rendered: RenderedTimeline;
  branches: ChildTimeline[];
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

      <section aria-labelledby="branches-heading" className="space-y-2">
        <h2
          id="branches-heading"
          className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
        >
          Branches from this timeline
        </h2>
        {branches.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No branches yet. This version is a leaf for now.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {branches.map((branch, index) => (
              <li key={branch.id}>
                <Link
                  className="underline hover:text-neutral-600"
                  href={`/stories/${slug}/t/${branch.id}`}
                >
                  {branch.label ?? `Branch ${index + 1}`}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-heading" className="space-y-2">
        <h2
          id="history-heading"
          className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
        >
          History
        </h2>
        <ol className="space-y-1 text-sm text-neutral-500">
          {history.map((entry, index) => (
            <li key={entry.id}>
              <Link
                className="underline hover:text-neutral-600"
                href={`/stories/${slug}/t/${entry.id}`}
              >
                {index === 0 ? "Seed" : (entry.label ?? `Timeline ${index}`)}
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
