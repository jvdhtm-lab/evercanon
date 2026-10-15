import { and, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { timelineEdits, timelines, voteTargets } from "@/db/schema";
import { DomainError, ValidationError } from "@/domain/errors";
import { hashText } from "@/domain/hash";
import { validateSpanSelection } from "@/domain/spans";
import { renderTimeline } from "@/services/timeline";

export class StaleEditError extends DomainError {
  constructor() {
    super(
      "stale_edit",
      "The text has changed since your form loaded. Reload and try again.",
    );
  }
}

export class TargetUnitNotFoundError extends DomainError {
  constructor(unitId: string) {
    super("target_unit_not_found", `Unit ${unitId} is not part of this timeline`);
  }
}

export class InvalidSpanError extends DomainError {
  constructor(reason: string) {
    super("invalid_span", `The selected span is invalid (${reason})`);
  }
}

export const MAX_EDIT_TEXT_LENGTH = 5000;

interface BaseProposalInput {
  storyId: string;
  parentTimelineId: string;
  targetUnitId: string;
  selectedText: string;
  replacementText: string;
  requestKey?: string | null;
  label?: string | null;
  creatorVisitorId?: string | null;
}

export type ProposeUnitReplacementInput = BaseProposalInput;

export interface ProposeSpanReplacementInput extends BaseProposalInput {
  startOffset: number;
  endOffset: number;
}

export interface ProposalResult {
  timelineId: string;
  created: boolean;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function validateReplacement(replacementText: string): void {
  if (replacementText.trim().length === 0) {
    throw new ValidationError("empty_replacement", "Replacement text is empty");
  }
  if (replacementText.length > MAX_EDIT_TEXT_LENGTH) {
    throw new ValidationError(
      "replacement_too_long",
      `Replacement text exceeds ${MAX_EDIT_TEXT_LENGTH} characters`,
    );
  }
}

async function loadParentUnitText(
  db: Database,
  storyId: string,
  parentTimelineId: string,
  targetUnitId: string,
): Promise<string> {
  // Throws TimelineNotFoundError for a nonexistent or cross-story parent.
  const parent = await renderTimeline(db, storyId, parentTimelineId);
  const unit = parent.units.find((u) => u.unitId === targetUnitId);
  if (!unit) throw new TargetUnitNotFoundError(targetUnitId);
  return unit.text;
}

async function createChildEdit(
  db: Database,
  input: {
    storyId: string;
    parentTimelineId: string;
    targetUnitId: string;
    scopeType: "unit" | "span";
    startOffset: number | null;
    endOffset: number | null;
    selectedText: string;
    replacementText: string;
    parentTextHash: string;
    requestKey: string | null;
    label: string | null;
    creatorVisitorId: string | null;
  },
): Promise<ProposalResult> {
  const { storyId, requestKey } = input;

  try {
    return await db.transaction(async (tx) => {
      if (requestKey) {
        const existing = await tx
          .select({ timelineId: timelineEdits.timelineId })
          .from(timelineEdits)
          .where(
            and(
              eq(timelineEdits.storyId, storyId),
              eq(timelineEdits.requestKey, requestKey),
            ),
          )
          .limit(1);
        if (existing[0]) {
          return { timelineId: existing[0].timelineId, created: false };
        }
      }

      const [timeline] = await tx
        .insert(timelines)
        .values({
          storyId,
          parentTimelineId: input.parentTimelineId,
          label: input.label,
          createdByVisitorId: input.creatorVisitorId,
        })
        .returning({ id: timelines.id });

      await tx.insert(timelineEdits).values({
        storyId,
        timelineId: timeline.id,
        targetUnitId: input.targetUnitId,
        scopeType: input.scopeType,
        operation: "replace",
        startOffset: input.startOffset,
        endOffset: input.endOffset,
        selectedText: input.selectedText,
        replacementText: input.replacementText,
        parentTextHash: input.parentTextHash,
        requestKey,
      });

      // The branch target represents the change introduced by this timeline.
      await tx.insert(voteTargets).values({
        storyId,
        timelineId: timeline.id,
        targetKind: "branch",
        targetText: input.replacementText,
        targetKey: "branch",
      });

      return { timelineId: timeline.id, created: true };
    });
  } catch (error) {
    if (requestKey && isUniqueViolation(error)) {
      const rows = await db
        .select({ timelineId: timelineEdits.timelineId })
        .from(timelineEdits)
        .where(
          and(
            eq(timelineEdits.storyId, storyId),
            eq(timelineEdits.requestKey, requestKey),
          ),
        )
        .limit(1);
      if (rows[0]) return { timelineId: rows[0].timelineId, created: false };
    }
    throw error;
  }
}

/** Replaces an entire unit (sentence) with new text. */
export async function proposeUnitReplacement(
  db: Database,
  input: ProposeUnitReplacementInput,
): Promise<ProposalResult> {
  validateReplacement(input.replacementText);
  const parentText = await loadParentUnitText(
    db,
    input.storyId,
    input.parentTimelineId,
    input.targetUnitId,
  );
  if (parentText !== input.selectedText) throw new StaleEditError();

  return createChildEdit(db, {
    storyId: input.storyId,
    parentTimelineId: input.parentTimelineId,
    targetUnitId: input.targetUnitId,
    scopeType: "unit",
    startOffset: null,
    endOffset: null,
    selectedText: input.selectedText,
    replacementText: input.replacementText,
    parentTextHash: hashText(parentText),
    requestKey: input.requestKey ?? null,
    label: input.label ?? null,
    creatorVisitorId: input.creatorVisitorId ?? null,
  });
}

/** Replaces a word/phrase span within a unit, using UTF-16 offsets. */
export async function proposeSpanReplacement(
  db: Database,
  input: ProposeSpanReplacementInput,
): Promise<ProposalResult> {
  validateReplacement(input.replacementText);
  const parentText = await loadParentUnitText(
    db,
    input.storyId,
    input.parentTimelineId,
    input.targetUnitId,
  );

  const validation = validateSpanSelection(
    parentText,
    input.startOffset,
    input.endOffset,
    input.selectedText,
  );
  if (!validation.valid) {
    // A mismatch on the selected text is a stale form, not a malformed span.
    if (validation.reason === "selected_text_mismatch") throw new StaleEditError();
    throw new InvalidSpanError(validation.reason ?? "unknown");
  }

  return createChildEdit(db, {
    storyId: input.storyId,
    parentTimelineId: input.parentTimelineId,
    targetUnitId: input.targetUnitId,
    scopeType: "span",
    startOffset: input.startOffset,
    endOffset: input.endOffset,
    selectedText: input.selectedText,
    replacementText: input.replacementText,
    parentTextHash: hashText(parentText),
    requestKey: input.requestKey ?? null,
    label: input.label ?? null,
    creatorVisitorId: input.creatorVisitorId ?? null,
  });
}
