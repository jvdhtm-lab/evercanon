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

export class ValidationError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}

export class VoteTargetNotFoundError extends DomainError {
  constructor(voteTargetId: string) {
    super("vote_target_not_found", `Vote target not found: ${voteTargetId}`);
  }
}

export class RateLimitError extends DomainError {
  constructor() {
    super("rate_limited", "Too many requests. Please slow down.");
  }
}
