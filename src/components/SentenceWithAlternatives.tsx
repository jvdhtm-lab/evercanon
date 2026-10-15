"use client";

import Link from "next/link";
import { useState } from "react";

import { BranchVote } from "@/components/BranchVote";

export interface AlternativeItem {
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

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * A sentence plus a discoverable panel of alternative versions. Desktop users
 * hover to reveal; touch and keyboard users toggle with the button, and Escape
 * closes the panel.
 */
export function SentenceWithAlternatives({
  slug,
  text,
  changed,
  alternatives,
}: {
  slug: string;
  text: string;
  changed: boolean;
  alternatives: AlternativeItem[];
}) {
  // `hover` is driven by the pointer (desktop); `pinned` by an explicit click
  // or keyboard activation (touch/keyboard). The panel is visible if either is
  // set, so clicking a hovered toggle does not immediately close it.
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const hasAlternatives = alternatives.length > 0;
  const open = hover || pinned;

  return (
    <span
      className="relative"
      onMouseEnter={() => hasAlternatives && setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span
        className={
          changed
            ? "underline decoration-dotted decoration-neutral-400 underline-offset-4"
            : undefined
        }
      >
        {text}
      </span>
      {hasAlternatives ? (
        <button
          type="button"
          data-testid="alternatives-toggle"
          aria-expanded={open}
          aria-label={`Show ${alternatives.length} alternative version${
            alternatives.length === 1 ? "" : "s"
          }`}
          onClick={() => setPinned((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setPinned(false);
              setHover(false);
            }
          }}
          className="ml-1 align-super text-xs text-neutral-400 hover:text-neutral-700"
        >
          ◆
        </button>
      ) : null}

      {open && hasAlternatives ? (
        <span
          data-testid="alternatives-panel"
          className="absolute left-0 z-20 mt-2 block w-96 max-w-[80vw] rounded-lg border border-neutral-200 bg-white p-3 text-left font-sans text-sm shadow-xl"
        >
          <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Explore another reality
          </span>
          <ul className="mt-2 space-y-2">
            {alternatives.map((alternative) => (
              <li
                key={alternative.timelineId}
                className="flex items-start gap-2"
              >
                {alternative.voteTargetId ? (
                  <BranchVote
                    voteTargetId={alternative.voteTargetId}
                    initial={{
                      upvotes: alternative.upvotes,
                      downvotes: alternative.downvotes,
                      netScore: alternative.netScore,
                      myVote: alternative.myVote,
                    }}
                  />
                ) : null}
                <span className="flex-1">
                  <Link
                    className="underline hover:text-neutral-600"
                    href={`/stories/${slug}/t/${alternative.timelineId}`}
                  >
                    {alternative.changeText
                      ? truncate(alternative.changeText, 90)
                      : (alternative.label ?? "alternative")}
                  </Link>
                  {alternative.isChosen ? (
                    <span className="ml-1 text-xs text-neutral-400">
                      (currently shown)
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </span>
      ) : null}
    </span>
  );
}
