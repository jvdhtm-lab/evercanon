/**
 * Span selection validation. Offsets are zero-based UTF-16 code-unit offsets,
 * matching JavaScript/DOM selection APIs. A valid span must be in bounds, must
 * match the selected text, and must not split a Unicode surrogate pair.
 */

export interface SpanValidation {
  valid: boolean;
  reason?: string;
}

/** True when `index` falls between a high and low surrogate (inside a pair). */
export function splitsSurrogatePair(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) return false;
  const previous = text.charCodeAt(index - 1);
  const current = text.charCodeAt(index);
  return (
    previous >= 0xd800 &&
    previous <= 0xdbff &&
    current >= 0xdc00 &&
    current <= 0xdfff
  );
}

export function validateSpanSelection(
  text: string,
  start: number,
  end: number,
  selectedText: string,
): SpanValidation {
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return { valid: false, reason: "offsets_not_integers" };
  }
  if (start < 0 || end < start || end > text.length) {
    return { valid: false, reason: "out_of_bounds" };
  }
  if (splitsSurrogatePair(text, start) || splitsSurrogatePair(text, end)) {
    return { valid: false, reason: "splits_surrogate_pair" };
  }
  if (text.slice(start, end) !== selectedText) {
    return { valid: false, reason: "selected_text_mismatch" };
  }
  return { valid: true };
}
