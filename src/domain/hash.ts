import { createHash } from "node:crypto";

/**
 * SHA-256 hex digest of text, hashed as UTF-8. Used as the optimistic
 * concurrency guard for span edits: a patch stores the hash of the parent's
 * rendered text, and a later write must reproduce it.
 */
export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
