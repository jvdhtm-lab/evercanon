"use client";

import { useState } from "react";

interface VoteScores {
  upvotes: number;
  downvotes: number;
  netScore: number;
  myVote: number | null;
}

export function BranchVote({
  voteTargetId,
  initial,
}: {
  voteTargetId: string;
  initial: VoteScores;
}) {
  const [scores, setScores] = useState<VoteScores>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(value: 1 | -1) {
    // Clicking the active vote again clears it.
    const next = scores.myVote === value ? 0 : value;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/vote-targets/${voteTargetId}/vote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: next }),
      });
      const data: VoteScores & { error?: string } = await response
        .json()
        .catch(() => ({}) as VoteScores & { error?: string });

      if (!response.ok) {
        setError(data.error ?? "Vote failed");
        return;
      }
      setScores({
        upvotes: data.upvotes,
        downvotes: data.downvotes,
        netScore: data.netScore,
        myVote: data.myVote,
      });
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  const active = "bg-neutral-900 text-white";
  const idle = "border border-neutral-300 text-neutral-600 hover:bg-neutral-100";

  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <button
        type="button"
        aria-label="Upvote this version"
        aria-pressed={scores.myVote === 1}
        disabled={pending}
        onClick={() => submit(1)}
        className={`rounded px-1.5 py-0.5 leading-none disabled:opacity-50 ${
          scores.myVote === 1 ? active : idle
        }`}
      >
        ▲
      </button>
      <span
        data-testid="net-score"
        title={`${scores.upvotes} up, ${scores.downvotes} down`}
        className="min-w-6 text-center tabular-nums"
      >
        {scores.netScore}
      </span>
      <button
        type="button"
        aria-label="Downvote this version"
        aria-pressed={scores.myVote === -1}
        disabled={pending}
        onClick={() => submit(-1)}
        className={`rounded px-1.5 py-0.5 leading-none disabled:opacity-50 ${
          scores.myVote === -1 ? active : idle
        }`}
      >
        ▼
      </button>
      {error ? (
        <span role="alert" className="text-red-600">
          {error}
        </span>
      ) : null}
    </span>
  );
}
