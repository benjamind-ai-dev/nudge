/**
 * Pure helper for `{{variable}}` completion — exported so it can be unit-tested
 * in isolation without importing the CodeMirror component.
 */

/**
 * Given the text before the cursor and the list of variable names, returns the
 * completion result `{ from, options }` or `null` when no `{{` trigger is active.
 *
 * Mirrors the `detectTrigger` + `applySuggestion` logic from the old
 * `variable-textarea.helpers.ts` but shaped for CodeMirror's CompletionSource API.
 */
export function computeVariableCompletion(
  textBeforeCursor: string,
  variables: string[],
): { from: number; options: { label: string; apply: string }[] } | null {
  const match = /\{\{(\w*)$/.exec(textBeforeCursor);
  if (!match) return null;
  const partial = match[1];
  const from = match.index; // absolute position of `{{` in textBeforeCursor
  const options = variables
    .filter((v) => v.startsWith(partial))
    .map((v) => ({ label: v, apply: `{{${v}}}` }));
  return options.length > 0 ? { from, options } : null;
}
