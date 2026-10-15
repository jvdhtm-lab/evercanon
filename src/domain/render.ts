/**
 * Pure timeline rendering. No database access, no side effects, deterministic
 * output for a given set of units and ancestor-ordered patches.
 *
 * A patch is interpreted against the text as rendered on its own parent
 * timeline. Because patches are applied root-to-leaf, when a patch is reached
 * the target unit already holds the text its parent rendered.
 */

export type UnitType = "sentence" | "paragraph";
export type ScopeType = "unit" | "span";
export type EditOperation =
  | "replace"
  | "insert_before"
  | "insert_after"
  | "delete";

export interface StoryUnitInput {
  id: string;
  position: number;
  unitType: UnitType;
  initialText: string;
}

export interface EditPatch {
  timelineId: string;
  targetUnitId: string;
  scopeType: ScopeType;
  operation: EditOperation;
  startOffset: number | null;
  endOffset: number | null;
  selectedText: string;
  replacementText: string;
}

export interface RenderedUnit {
  unitId: string;
  position: number;
  unitType: UnitType;
  text: string;
  /** Timeline whose edit last changed this unit, or null for untouched seed text. */
  changedByTimelineId: string | null;
}

export interface RenderedTimeline {
  storyId: string;
  timelineId: string;
  /** Ancestry from root to the requested timeline, inclusive. */
  pathTimelineIds: string[];
  units: RenderedUnit[];
}

export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderError";
  }
}

function applyPatchToText(text: string, patch: EditPatch): string {
  switch (patch.operation) {
    case "replace": {
      if (patch.scopeType === "unit") {
        return patch.replacementText;
      }
      const { startOffset, endOffset } = patch;
      if (startOffset === null || endOffset === null) {
        throw new RenderError("Span replace requires start and end offsets");
      }
      if (startOffset < 0 || endOffset > text.length || endOffset < startOffset) {
        throw new RenderError(
          `Span offsets ${startOffset}..${endOffset} are out of bounds for a unit of length ${text.length}`,
        );
      }
      if (patch.selectedText !== "" && text.slice(startOffset, endOffset) !== patch.selectedText) {
        throw new RenderError(
          "Stored span no longer matches the parent rendering (stale patch)",
        );
      }
      return text.slice(0, startOffset) + patch.replacementText + text.slice(endOffset);
    }
    default:
      throw new RenderError(
        `Operation "${patch.operation}" is not supported by the renderer yet`,
      );
  }
}

/**
 * Applies ancestor-ordered patches to seed units, returning units in position
 * order. Throws if a patch targets an unknown unit.
 */
export function applyPatches(
  units: StoryUnitInput[],
  patches: EditPatch[],
): RenderedUnit[] {
  const byId = new Map<string, RenderedUnit>();
  for (const unit of units) {
    byId.set(unit.id, {
      unitId: unit.id,
      position: unit.position,
      unitType: unit.unitType,
      text: unit.initialText,
      changedByTimelineId: null,
    });
  }

  for (const patch of patches) {
    const unit = byId.get(patch.targetUnitId);
    if (!unit) {
      throw new RenderError(`Patch targets unknown unit ${patch.targetUnitId}`);
    }
    unit.text = applyPatchToText(unit.text, patch);
    unit.changedByTimelineId = patch.timelineId;
  }

  return [...byId.values()].sort((a, b) => a.position - b.position);
}

/** Joins rendered units into the displayable story text. */
export function renderToPlainText(units: RenderedUnit[]): string {
  return units.map((unit) => unit.text).join(" ");
}
