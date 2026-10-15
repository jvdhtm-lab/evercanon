import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import { stories } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function Home() {
  const db = getDb();
  const [story] = await db
    .select({ slug: stories.slug })
    .from(stories)
    .orderBy(asc(stories.createdAt))
    .limit(1);

  if (story) {
    redirect(`/stories/${story.slug}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Evercanon</h1>
      <p className="italic text-neutral-500">
        Nothing is final. Everything leaves a trace.
      </p>
      <p className="text-neutral-600">
        No story has been seeded yet. Run <code>npm run db:seed</code> after
        applying migrations.
      </p>
    </main>
  );
}
