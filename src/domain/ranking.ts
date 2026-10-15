/**
 * Deterministic branch ranking. At a fork, the preferred child is chosen by:
 *   1. net score (upvotes - downvotes) descending
 *   2. upvotes descending
 *   3. earlier creation time
 *   4. UUID ascending
 *
 * Only the child's own branch score is used; descendant votes are never summed
 * into an ancestor. Ties fall back to stable, reproducible keys so the site does
 * not change between refreshes.
 */

export interface RankableBranch {
  netScore: number;
  upvotes: number;
  createdAt: Date;
  timelineId: string;
}

export function compareBranches(a: RankableBranch, b: RankableBranch): number {
  if (a.netScore !== b.netScore) return b.netScore - a.netScore;
  if (a.upvotes !== b.upvotes) return b.upvotes - a.upvotes;

  const timeDelta = a.createdAt.getTime() - b.createdAt.getTime();
  if (timeDelta !== 0) return timeDelta;

  if (a.timelineId < b.timelineId) return -1;
  if (a.timelineId > b.timelineId) return 1;
  return 0;
}

/** Returns the preferred branch, or null when the fork has no children. */
export function pickPreferredBranch<T extends RankableBranch>(
  branches: readonly T[],
): T | null {
  if (branches.length === 0) return null;
  return [...branches].sort(compareBranches)[0];
}
