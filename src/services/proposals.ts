import { and, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { timelineEdits, timelines, voteTargets } from "@/db/schema";
import { DomainError, ValidationError } from "@/domain/errors";
import { hashText } from "@/domain/hash";
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

export const MAX_EDIT_TEXT_LENGTH = 5000;

export interface ProposeUnitReplacementInput {
  storyId: string;
  parentTimelineId: string;
  targetUnitId: string;
  selectedText: string;
  replacementText: string;
  requestKey?: string | null;
  label?: string | null;
  creatorVisitorId?: string | null;
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

/**
 * Creates a child timeline with a whole-unit replacement patch, atomically.
 *
 * The parent is re-rendered server-side and the client's `selectedText` must
 * match it exactly; otherwise the proposal is rejected as stale. Timeline and
 * edit are inserted in one transaction, and a supplied `requestKey` makes
 * retries idempotent.
 */
export async function proposeUnitReplacement(
  db: Database,
  input: ProposeUnitReplacementInput,
): Promise<ProposalResult> {
  const replacementText = input.replacementText;
  if (replacementText.trim().length === 0) {
    throw new ValidationError("empty_replacement", "Replacement text is empty");
  }
  if (replacementText.length > MAX_EDIT_TEXT_LENGTH) {
    throw new ValidationError(
      "replacement_too_long",
      `Replacement text exceeds ${MAX_EDIT_TEXT_LENGTH} characters`,
    );
  }

  // Throws TimelineNotFoundError for a nonexistent or cross-story parent.
  const parent = await renderTimeline(db, input.storyId, input.parentTimelineId);
  const unit = parent.units.find((u) => u.unitId === input.targetUnitId);
  if (!unit) throw new TargetUnitNotFoundError(input.targetUnitId);
  if (unit.text !== input.selectedText) throw new StaleEditError();

  const parentTextHash = hashText(unit.text);
  const requestKey = input.requestKey ?? null;

  try {
    return await db.transaction(async (tx) => {
      if (requestKey) {
        const existing = await tx
          .select({ timelineId: timelineEdits.timelineId })
          .from(timelineEdits)
          .where(
            and(
              eq(timelineEdits.storyId, input.storyId),
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
          storyId: input.storyId,
          parentTimelineId: input.parentTimelineId,
          label: input.label ?? null,
          createdByVisitorId: input.creatorVisitorId ?? null,
        })
        .returning({ id: timelines.id });

      await tx.insert(timelineEdits).values({
        storyId: input.storyId,
        timelineId: timeline.id,
        targetUnitId: input.targetUnitId,
        scopeType: "unit",
        operation: "replace",
        startOffset: null,
        endOffset: null,
        selectedText: input.selectedText,
        replacementText,
        parentTextHash,
        requestKey,
      });

      // A branch target represents the change introduced by this child timeline.
      await tx.insert(voteTargets).values({
        storyId: input.storyId,
        timelineId: timeline.id,
        targetKind: "branch",
        targetText: replacementText,
        targetKey: "branch",
      });

      return { timelineId: timeline.id, created: true };
    });
  } catch (error) {
    // A concurrent retry with the same request key won the race.
    if (requestKey && isUniqueViolation(error)) {
      const rows = await db
        .select({ timelineId: timelineEdits.timelineId })
        .from(timelineEdits)
        .where(
          and(
            eq(timelineEdits.storyId, input.storyId),
            eq(timelineEdits.requestKey, requestKey),
          ),
        )
        .limit(1);
      if (rows[0]) {
        return { timelineId: rows[0].timelineId, created: false };
      }
    }
    throw error;
  }
}
