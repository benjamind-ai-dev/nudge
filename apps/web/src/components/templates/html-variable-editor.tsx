/**
 * HtmlVariableEditor — CodeMirror 6 field with:
 *  - HTML syntax highlighting + auto-close tags
 *  - {{variable}} autocomplete (triggers on `{{`)
 *  - Variable chip row that inserts at the cursor
 *  - Controlled (value / onChange)
 *  - Theme uses CSS custom properties so light/dark follows the app automatically
 */

import CodeMirror from "@uiw/react-codemirror";
import { html, htmlLanguage } from "@codemirror/lang-html";
import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import { useCallback, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { computeVariableCompletion } from "./variable-completion";

// ---------------------------------------------------------------------------
// Variable completion source factory
// ---------------------------------------------------------------------------

function makeVariableCompletionSource(variables: string[]) {
  return function variableCompletionSource(
    ctx: CompletionContext,
  ): CompletionResult | null {
    const textBefore = ctx.state.sliceDoc(0, ctx.pos);
    const result = computeVariableCompletion(textBefore, variables);
    if (!result) return null;
    return {
      from: result.from,
      options: result.options,
      validFor: /^\{\{\w*$/,
    };
  };
}

// ---------------------------------------------------------------------------
// CSS-variable-based theme (auto-adapts to light/dark via the app's :root vars)
// ---------------------------------------------------------------------------

const nudgeTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--card)",
    color: "var(--foreground)",
    borderRadius: "calc(var(--radius) - 2px)",
    fontSize: "13px",
    fontFamily: "inherit",
  },
  ".cm-content": {
    caretColor: "var(--primary)",
    padding: "8px 12px",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--primary)",
  },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent)",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent)",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--muted) 50%, transparent)",
  },
  ".cm-gutters": {
    display: "none",
  },
  ".cm-placeholder": {
    color: "var(--muted-foreground)",
  },
  // Completion tooltip
  ".cm-tooltip.cm-tooltip-autocomplete": {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--popover-foreground)",
    boxShadow: "0 4px 12px -2px rgba(0,0,0,0.15)",
    fontSize: "12px",
    fontFamily: "ui-monospace, monospace",
  },
  ".cm-tooltip-autocomplete ul li": {
    padding: "4px 10px",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface HtmlVariableEditorProps {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  variables: string[];
  placeholder?: string;
  minHeight?: string;
  invalid?: boolean;
  ariaLabel?: string;
}

export function HtmlVariableEditor({
  id,
  value,
  onChange,
  variables,
  placeholder,
  minHeight = "160px",
  invalid = false,
  ariaLabel,
}: HtmlVariableEditorProps) {
  const viewRef = useRef<EditorView | null>(null);

  const handleChipClick = useCallback(
    (variable: string) => {
      const view = viewRef.current;
      if (!view) return;
      const token = `{{${variable}}}`;
      view.dispatch(view.state.replaceSelection(token));
      view.focus();
    },
    [],
  );

  const extensions = useMemo(
    () => [
      html({ autoCloseTags: true }),
      // Register variable completion as a language-data source so it MERGES with
      // HTML's own tag/attribute completions (registered the same way). Using
      // `override` would shadow HTML completions entirely — don't use override.
      htmlLanguage.data.of({ autocomplete: makeVariableCompletionSource(variables) }),
      autocompletion(), // no override — picks up both language-data sources
      nudgeTheme,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ "aria-label": ariaLabel ?? "Template field" }),
    ],
    [variables, ariaLabel],
  );

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "overflow-hidden rounded-[calc(var(--radius)-2px)] border bg-card transition-colors",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0",
          invalid
            ? "border-destructive focus-within:ring-destructive/40"
            : "border-input",
        )}
        style={{ minHeight }}
      >
        <CodeMirror
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          theme="none"
          extensions={extensions}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: true,
            bracketMatching: false,
            autocompletion: false, // we supply our own via extensions
            indentOnInput: true,
            closeBrackets: false,
            highlightSelectionMatches: false,
            searchKeymap: false,
          }}
          onCreateEditor={(view) => {
            viewRef.current = view;
          }}
          aria-label={ariaLabel}
          style={{ minHeight }}
        />
      </div>

      {/* Variable chip row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">Variables:</span>
        {variables.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => handleChipClick(v)}
            className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
