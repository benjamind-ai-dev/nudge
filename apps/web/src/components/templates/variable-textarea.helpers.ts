/**
 * Pure helpers for variable-aware textarea — no React, no side effects.
 * Exported so they can be unit-tested in isolation.
 */

/**
 * Splice `token` into `value` at [selStart, selEnd), replacing any selection.
 * Returns the new value and the caret index immediately after the inserted token.
 */
export function insertToken(
  value: string,
  selStart: number,
  selEnd: number,
  token: string,
): { value: string; caret: number } {
  const before = value.slice(0, selStart);
  const after = value.slice(selEnd);
  const newValue = before + token + after;
  return { value: newValue, caret: selStart + token.length };
}

/**
 * Detect an open `{{` trigger in the text before the caret.
 * Matches `/\{\{(\w*)$/` — i.e. `{{` optionally followed by word chars, with
 * no closing `}}` after it in the same segment.
 *
 * Returns `{ partial, start }` where `start` is the index of the `{{`
 * within `textBeforeCaret`, or null if no active trigger.
 */
export function detectTrigger(
  textBeforeCaret: string,
): { partial: string; start: number } | null {
  const match = /\{\{(\w*)$/.exec(textBeforeCaret);
  if (!match) return null;
  return {
    partial: match[1],
    start: match.index,
  };
}

/**
 * Replace the range [triggerStart, caret) — the typed `{{partial` —
 * with the completed `{{name}}` token.
 * Returns the new value and the caret index immediately after `}}`.
 */
export function applySuggestion(
  value: string,
  triggerStart: number,
  caret: number,
  name: string,
): { value: string; caret: number } {
  const token = `{{${name}}}`;
  const before = value.slice(0, triggerStart);
  const after = value.slice(caret);
  const newValue = before + token + after;
  return { value: newValue, caret: triggerStart + token.length };
}
