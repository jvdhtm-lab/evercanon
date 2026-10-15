import Link from "next/link";

import type { TimelineSummary } from "@/services/timeline";

export function History({
  slug,
  history,
}: {
  slug: string;
  history: TimelineSummary[];
}) {
  return (
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
  );
}
