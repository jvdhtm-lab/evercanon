export const dynamic = "force-dynamic";

const seedSentence =
  "In the beginning, in the yard of angels, there were twelve dwarves and one irrational number.";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <h1 className="font-sans text-4xl font-semibold tracking-tight">
          Evercanon
        </h1>
        <p className="text-lg italic text-neutral-500">
          Nothing is final. Everything leaves a trace.
        </p>
      </header>

      <blockquote className="border-l-2 border-neutral-300 pl-4 text-xl leading-relaxed">
        {seedSentence}
      </blockquote>

      <p className="text-neutral-600">
        Every word can change. Every change creates another possibility. The
        world you see is the one we chose together &mdash; for now.
      </p>

      <p className="text-sm text-neutral-400">
        Phase 0 scaffold. The story will be read from PostgreSQL in Phase 1.
      </p>
    </main>
  );
}
