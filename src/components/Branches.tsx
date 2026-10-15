import Link from "next/link";

import { BranchVote } from "@/components/BranchVote";
import type { BranchOption } from "@/services/timeline";

export function Branches({
  slug,
  branches,
}: {
  slug: string;
  branches: BranchOption[];
}) {
  return (
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
        <ul className="space-y-2 text-sm">
          {branches.map((branch, index) => (
            <li key={branch.timelineId} className="flex items-center gap-3">
              <Link
                className="underline hover:text-neutral-600"
                href={`/stories/${slug}/t/${branch.timelineId}`}
              >
                {branch.label ?? `Branch ${index + 1}`}
              </Link>
              {branch.voteTargetId ? (
                <BranchVote
                  voteTargetId={branch.voteTargetId}
                  initial={{
                    upvotes: branch.upvotes,
                    downvotes: branch.downvotes,
                    netScore: branch.netScore,
                    myVote: branch.myVote,
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
