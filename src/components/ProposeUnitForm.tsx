"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const MAX_LENGTH = 5000;

export function ProposeUnitForm({
  slug,
  parentTimelineId,
  unitId,
  currentText,
}: {
  slug: string;
  parentTimelineId: string;
  unitId: string;
  currentText: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentText);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/stories/${slug}/proposals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          parentTimelineId,
          targetUnitId: unitId,
          selectedText: currentText,
          replacementText: value,
          requestKey: crypto.randomUUID(),
        }),
      });
      const data: { url?: string; message?: string } = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !data.url) {
        setError(data.message ?? "Could not submit the proposal.");
        setPending(false);
        return;
      }
      router.push(data.url);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setPending(false);
    }
  }

  return (
    <details className="rounded border border-neutral-200 p-3">
      <summary className="cursor-pointer text-sm text-neutral-600">
        Propose an alternative
      </summary>
      <form onSubmit={onSubmit} className="mt-3 space-y-2">
        <label className="block text-xs text-neutral-500" htmlFor={`edit-${unitId}`}>
          Replace this sentence with:
        </label>
        <textarea
          id={`edit-${unitId}`}
          className="w-full rounded border border-neutral-300 p-2 text-base"
          rows={3}
          maxLength={MAX_LENGTH}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending || value.trim().length === 0}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Submit proposal"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setValue(currentText)}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
          >
            Reset
          </button>
        </div>
      </form>
    </details>
  );
}
