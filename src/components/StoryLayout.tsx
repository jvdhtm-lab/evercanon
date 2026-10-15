import type { ReactNode } from "react";

export function StoryLayout({
  children,
  timelineId,
  footer,
}: {
  children: ReactNode;
  timelineId: string;
  footer?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Evercanon</h1>
        <p className="italic text-neutral-500">
          Nothing is final. Everything leaves a trace.
        </p>
      </header>

      {children}

      <footer className="mt-auto space-y-2 border-t border-neutral-200 pt-4 text-xs text-neutral-400">
        <p>
          Timeline <code data-testid="timeline-id">{timelineId}</code>
        </p>
        {footer}
      </footer>
    </main>
  );
}
