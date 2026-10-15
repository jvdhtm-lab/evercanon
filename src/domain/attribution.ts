/**
 * Pure rules for derived support. A direct vote is the only voter action;
 * attribution rows are a projection of that one vote onto related text targets
 * in the same rendered timeline. These rules are applied once (never
 * recursively) and are rebuildable from direct votes plus this function.
 */

export type TargetKind = "branch" | "sentence" | "phrase" | "word";
export type AttributionKind = "direct" | "contained" | "ancestor";

export interface AttributionTarget {
  id: string;
  kind: TargetKind;
  timelineId: string;
  unitId: string | null;
}

export interface AttributionRow {
  supportedTargetId: string;
  kind: AttributionKind;
  weight: number;
}

/**
 * A sentence vote supports the word/phrase targets selected inside that
 * sentence; a word/phrase vote supports its containing sentence. Unrelated
 * targets and targets in other timelines are never included.
 */
export function computeAttributions(
  voted: AttributionTarget,
  candidates: readonly AttributionTarget[],
): AttributionRow[] {
  const rows: AttributionRow[] = [
    { supportedTargetId: voted.id, kind: "direct", weight: 1 },
  ];

  if (!voted.unitId) return rows;

  const sameUnit = candidates.filter(
    (candidate) =>
      candidate.timelineId === voted.timelineId &&
      candidate.unitId === voted.unitId &&
      candidate.id !== voted.id,
  );

  if (voted.kind === "sentence") {
    for (const candidate of sameUnit) {
      if (candidate.kind === "word" || candidate.kind === "phrase") {
        rows.push({ supportedTargetId: candidate.id, kind: "contained", weight: 1 });
      }
    }
  } else if (voted.kind === "word" || voted.kind === "phrase") {
    for (const candidate of sameUnit) {
      if (candidate.kind === "sentence") {
        rows.push({ supportedTargetId: candidate.id, kind: "ancestor", weight: 1 });
      }
    }
  }

  return rows;
}
