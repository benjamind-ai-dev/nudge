/**
 * Pure helper for `{{variable}}` completion — exported so it can be unit-tested
 * in isolation without importing the CodeMirror component.
 */

export interface VariableCompletion {
  /** Document offset CodeMirror should replace from (just after the `{{`). */
  from: number;
  /** Completion options. `label` is matched/displayed; `apply` finishes the token. */
  options: { label: string; apply: string }[];
}

/**
 * Given the text before the cursor and the variable names, returns the
 * `{ from, options }` for a `{{` completion, or `null` when no `{{` trigger is
 * active.
 *
 * Important: `from` points at the partial word AFTER the `{{` (not at the `{{`
 * itself). CodeMirror filters option labels against the text in `[from, cursor)`,
 * so anchoring at the `{{` would make it match labels against "{{con" — the
 * braces break the match and every option gets filtered out. Anchoring after the
 * braces means it matches "con" against "contact_name" as expected. The braces
 * stay in the document; `apply` only needs to add the variable name + closing
 * `}}`. All options are returned and CodeMirror narrows them as the user types.
 */
export function computeVariableCompletion(
  textBeforeCursor: string,
  variables: string[],
): VariableCompletion | null {
  const match = /\{\{(\w*)$/.exec(textBeforeCursor);
  if (!match) return null;
  const from = match.index + 2; // position just after the `{{`
  const options = variables.map((v) => ({ label: v, apply: `${v}}}` }));
  return { from, options };
}
