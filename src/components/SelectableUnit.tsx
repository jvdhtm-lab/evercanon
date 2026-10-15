"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface Selection {
  start: number;
  end: number;
  text: string;
}

interface Scores {
  upvotes: number;
  downvotes: number;
  netScore: number;
  myVote: number | null;
}

/**
 * Renders one unit's text with word/phrase selection. Selecting text reveals a
 * panel to propose a span replacement or vote on the selected phrase; the whole
 * sentence can also be voted on. Offsets are UTF-16, matching the DOM.
 */
export function SelectableUnit({
  slug,
  timelineId,
  unitId,
  text,
}: {
  slug: string;
  timelineId: string;
  unitId: string;
  text: string;
}) {
  const router = useRouter();
  const ref = useRef<HTMLSpanElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [replacement, setReplacement] = useState("");
  const [sentence, setSentence] = useState<Scores | null>(null);
  const [spanScore, setSpanScore] = useState<Scores | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function readSelection() {
    const sel = window.getSelection();
    const node = ref.current;
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !node) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const textNode = ref.current?.firstChild;
    if (
      !textNode ||
      range.startContainer !== textNode ||
      range.endContainer !== textNode
    ) {
      setSelection(null);
      return;
    }
    const start = Math.min(range.startOffset, range.endOffset);
    const end = Math.max(range.startOffset, range.endOffset);
    if (start === end) {
      setSelection(null);
      return;
    }
    setSpanScore(null);
    setSelection({ start, end, text: text.slice(start, end) });
  }

  async function vote(
    kind: "sentence" | "span",
    value: 1 | -1,
    apply: (scores: Scores) => void,
    current: Scores | null,
  ) {
    setPending(true);
    setError(null);
    try {
      const body =
        kind === "sentence"
          ? { kind, unitId, value: current?.myVote === value ? 0 : value }
          : {
              kind,
              unitId,
              startOffset: selection!.start,
              endOffset: selection!.end,
              value,
            };
      const response = await fetch(
        `/api/stories/${slug}/timelines/${timelineId}/vote`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data: Scores & { error?: string } = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Vote failed");
        return;
      }
      apply({ upvotes: data.upvotes, downvotes: data.downvotes, netScore: data.netScore, myVote: data.myVote });
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  async function proposeSpan() {
    if (!selection) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/stories/${slug}/proposals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scopeType: "span",
          parentTimelineId: timelineId,
          targetUnitId: unitId,
          startOffset: selection.start,
          endOffset: selection.end,
          selectedText: selection.text,
          replacementText: replacement,
          requestKey: crypto.randomUUID(),
        }),
      });
      const data: { url?: string; message?: string } = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) {
        setError(data.message ?? "Could not submit the proposal.");
        return;
      }
      router.push(data.url);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  const voteButton = (active: boolean) =>
    `rounded px-1.5 py-0.5 leading-none text-xs disabled:opacity-50 ${
      active
        ? "bg-neutral-900 text-white"
        : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100"
    }`;

  return (
    <span className="font-serif text-xl leading-relaxed">
      <span
        ref={ref}
        data-testid="unit-text"
        className="cursor-text"
        onMouseUp={readSelection}
        onKeyUp={readSelection}
      >
        {text}
      </span>

      <span className="ml-2 inline-flex items-center gap-1 align-middle font-sans">
        <button
          type="button"
          aria-label="Upvote this sentence"
          aria-pressed={sentence?.myVote === 1}
          disabled={pending}
          onClick={() =>
            vote("sentence", 1, setSentence, sentence)
          }
          className={voteButton(sentence?.myVote === 1)}
        >
          ▲
        </button>
        <span data-testid="sentence-score" className="text-xs tabular-nums">
          {sentence?.netScore ?? "–"}
        </span>
        <button
          type="button"
          aria-label="Downvote this sentence"
          aria-pressed={sentence?.myVote === -1}
          disabled={pending}
          onClick={() => vote("sentence", -1, setSentence, sentence)}
          className={voteButton(sentence?.myVote === -1)}
        >
          ▼
        </button>
      </span>

      {selection ? (
        <span
          data-testid="selection-panel"
          className="mt-2 block rounded border border-neutral-200 bg-neutral-50 p-3 font-sans text-sm"
        >
          <span className="block text-xs text-neutral-500">
            Selected: <em>{selection.text}</em>
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
              placeholder="Replace selection with…"
              className="rounded border border-neutral-300 px-2 py-1 text-sm"
            />
            <button
              type="button"
              disabled={pending || replacement.trim().length === 0}
              onClick={proposeSpan}
              className="rounded bg-neutral-900 px-2 py-1 text-xs text-white disabled:opacity-50"
            >
              Propose change
            </button>
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                aria-label="Upvote this selection"
                disabled={pending}
                onClick={() => vote("span", 1, setSpanScore, spanScore)}
                className={voteButton(spanScore?.myVote === 1)}
              >
                ▲
              </button>
              <span data-testid="span-score" className="text-xs tabular-nums">
                {spanScore?.netScore ?? "–"}
              </span>
              <button
                type="button"
                aria-label="Downvote this selection"
                disabled={pending}
                onClick={() => vote("span", -1, setSpanScore, spanScore)}
                className={voteButton(spanScore?.myVote === -1)}
              >
                ▼
              </button>
            </span>
          </span>
        </span>
      ) : null}

      {error ? (
        <span role="alert" className="ml-2 font-sans text-sm text-red-600">
          {error}
        </span>
      ) : null}
    </span>
  );
}
