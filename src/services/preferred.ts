import type { Database } from "@/db/client";
import { pickPreferredBranch } from "@/domain/ranking";
import type { RenderedTimeline } from "@/domain/render";
import {
  getBranchOptions,
  getPathPatches,
  getRootTimelineId,
  renderTimeline,
  type BranchOption,
} from "@/services/timeline";

export interface PreferredPath {
  timelineId: string;
  /** Root-to-leaf timeline ids. */
  path: string[];
}

const MAX_DEPTH = 10000;

/**
 * Walks from the root, choosing the highest-ranked child at each fork, until a
 * leaf is reached. Returns the leaf timeline and the full path.
 */
export async function getPreferredTimeline(
  db: Database,
  storyId: string,
): Promise<PreferredPath | null> {
  const rootId = await getRootTimelineId(db, storyId);
  if (!rootId) return null;

  const path = [rootId];
  let current = rootId;

  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    const branches = await getBranchOptions(db, storyId, current, null);
    const best = pickPreferredBranch(branches);
    if (!best) break;
    path.push(best.timelineId);
    current = best.timelineId;
  }

  return { timelineId: current, path };
}

export interface UnitAlternative {
  timelineId: string;
  label: string | null;
  changeText: string | null;
  upvotes: number;
  downvotes: number;
  netScore: number;
  myVote: number | null;
  voteTargetId: string | null;
  isChosen: boolean;
}

export interface PreferredUnit {
  unitId: string;
  text: string;
  changed: boolean;
  forkTimelineId: string;
  alternatives: UnitAlternative[];
}

export interface PreferredView {
  preferred: PreferredPath;
  rendered: RenderedTimeline;
  units: PreferredUnit[];
}

/**
 * Builds the preferred reading plus, for each unit, the alternative branches
 * available at the fork that produced (or could produce) that unit's text.
 */
export async function getPreferredView(
  db: Database,
  storyId: string,
  visitorId: string | null,
): Promise<PreferredView | null> {
  const preferred = await getPreferredTimeline(db, storyId);
  if (!preferred) return null;

  const [rendered, patches, branchLists] = await Promise.all([
    renderTimeline(db, storyId, preferred.timelineId),
    getPathPatches(db, storyId, preferred.path),
    Promise.all(
      preferred.path.map((id) => getBranchOptions(db, storyId, id, visitorId)),
    ),
  ]);

  const branchesByParent = new Map<string, BranchOption[]>(
    preferred.path.map((id, index) => [id, branchLists[index]]),
  );
  const targetByTimeline = new Map(
    patches.map((patch) => [patch.timelineId, patch.targetUnitId]),
  );

  const units: PreferredUnit[] = rendered.units.map((unit) => {
    // Deepest path timeline whose edit touches this unit defines its fork.
    let chosenIndex = -1;
    for (let index = 1; index < preferred.path.length; index += 1) {
      if (targetByTimeline.get(preferred.path[index]) === unit.unitId) {
        chosenIndex = index;
      }
    }

    const forkTimelineId =
      chosenIndex === -1 ? preferred.path[0] : preferred.path[chosenIndex - 1];
    const chosenTimelineId =
      chosenIndex === -1 ? null : preferred.path[chosenIndex];

    const alternatives = (branchesByParent.get(forkTimelineId) ?? [])
      .filter((branch) => branch.targetUnitId === unit.unitId)
      .map((branch) => ({
        timelineId: branch.timelineId,
        label: branch.label,
        changeText: branch.changeText,
        upvotes: branch.upvotes,
        downvotes: branch.downvotes,
        netScore: branch.netScore,
        myVote: branch.myVote,
        voteTargetId: branch.voteTargetId,
        isChosen: branch.timelineId === chosenTimelineId,
      }));

    return {
      unitId: unit.unitId,
      text: unit.text,
      changed: unit.changedByTimelineId !== null,
      forkTimelineId,
      alternatives,
    };
  });

  return { preferred, rendered, units };
}
