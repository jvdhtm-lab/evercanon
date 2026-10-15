/** Domain-level errors with stable codes, safe to map to HTTP responses later. */
export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export class StoryNotFoundError extends DomainError {
  constructor(slugOrId: string) {
    super("story_not_found", `Story not found: ${slugOrId}`);
  }
}

export class TimelineNotFoundError extends DomainError {
  constructor(storyId: string, timelineId: string) {
    super(
      "timeline_not_found",
      `Timeline ${timelineId} does not belong to story ${storyId}`,
    );
  }
}
