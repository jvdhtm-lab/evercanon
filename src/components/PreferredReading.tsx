import { SentenceWithAlternatives } from "@/components/SentenceWithAlternatives";
import type { PreferredView } from "@/services/preferred";

export function PreferredReading({
  slug,
  view,
}: {
  slug: string;
  view: PreferredView;
}) {
  return (
    <article
      data-testid="story-text"
      className="space-y-4 font-serif text-xl leading-relaxed"
    >
      {view.units.map((unit) => (
        <p key={unit.unitId}>
          <SentenceWithAlternatives
            slug={slug}
            text={unit.text}
            changed={unit.changed}
            alternatives={unit.alternatives}
          />
        </p>
      ))}
    </article>
  );
}
