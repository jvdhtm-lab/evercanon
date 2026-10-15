import type { RenderedTimeline } from "@/domain/render";

/**
 * Renders a timeline's units as plain text. React escapes text nodes, so
 * user-contributed content can never execute as HTML.
 */
export function StoryText({ rendered }: { rendered: RenderedTimeline }) {
  return (
    <article
      data-testid="story-text"
      className="space-y-4 font-serif text-xl leading-relaxed"
    >
      {rendered.units.map((unit) => (
        <p key={unit.unitId}>{unit.text}</p>
      ))}
    </article>
  );
}
