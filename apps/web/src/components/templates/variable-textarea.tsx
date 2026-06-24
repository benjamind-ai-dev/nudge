import { cn } from "@/lib/utils";
import { useLayoutEffect, useRef, useState } from "react";
import { Textarea } from "../ui/textarea";
import { applySuggestion, detectTrigger, insertToken } from "./variable-textarea.helpers";

interface VariableTextareaProps {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  variables: string[];
  rows?: number;
  placeholder?: string;
  className?: string;
  "aria-invalid"?: boolean;
}

export function VariableTextarea({
  id,
  value,
  onChange,
  variables,
  rows,
  placeholder,
  className,
  "aria-invalid": ariaInvalid,
}: VariableTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaretRef = useRef<number | null>(null);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filteredVars, setFilteredVars] = useState<string[]>([]);
  const [triggerStart, setTriggerStart] = useState<number>(0);
  const [highlightIndex, setHighlightIndex] = useState(0);

  // After a controlled onChange, restore the caret to where we put it.
  useLayoutEffect(() => {
    if (pendingCaretRef.current !== null && textareaRef.current) {
      const pos = pendingCaretRef.current;
      textareaRef.current.selectionStart = pos;
      textareaRef.current.selectionEnd = pos;
      pendingCaretRef.current = null;
    }
  });

  function updateAutocomplete(newValue: string, caret: number) {
    const textBefore = newValue.slice(0, caret);
    const trigger = detectTrigger(textBefore);
    if (trigger) {
      const matches = variables.filter((v) => v.startsWith(trigger.partial));
      if (matches.length > 0) {
        setFilteredVars(matches);
        setTriggerStart(trigger.start);
        setHighlightIndex(0);
        setDropdownOpen(true);
        return;
      }
    }
    setDropdownOpen(false);
  }

  function acceptSuggestion(name: string) {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart;
    const result = applySuggestion(value, triggerStart, caret, name);
    pendingCaretRef.current = result.caret;
    onChange(result.value);
    setDropdownOpen(false);
    el.focus();
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value;
    const caret = e.target.selectionStart;
    onChange(newValue);
    updateAutocomplete(newValue, caret);
  }

  function handleKeyUp(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Re-evaluate the trigger on cursor movement (arrow keys, etc.)
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      const el = textareaRef.current;
      if (el) updateAutocomplete(value, el.selectionStart);
    }
  }

  function handleClick() {
    const el = textareaRef.current;
    if (el) updateAutocomplete(value, el.selectionStart);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!dropdownOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % filteredVars.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i - 1 + filteredVars.length) % filteredVars.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      acceptSuggestion(filteredVars[highlightIndex]);
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
    }
  }

  function handleChipClick(variable: string) {
    const el = textareaRef.current;
    const selStart = el?.selectionStart ?? value.length;
    const selEnd = el?.selectionEnd ?? value.length;
    const token = `{{${variable}}}`;
    const result = insertToken(value, selStart, selEnd, token);
    pendingCaretRef.current = result.caret;
    onChange(result.value);
    el?.focus();
  }

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={ariaInvalid}
        className={cn("resize-none", className)}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onClick={handleClick}
      />

      {dropdownOpen && filteredVars.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-48 w-56 overflow-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md"
        >
          {filteredVars.map((v, i) => (
            <li
              key={v}
              role="option"
              aria-selected={i === highlightIndex}
              onMouseDown={(e) => {
                // Prevent blur before we handle the click
                e.preventDefault();
                acceptSuggestion(v);
              }}
              className={cn(
                "cursor-pointer px-3 py-1.5 font-mono text-xs",
                i === highlightIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50",
              )}
            >
              {`{{${v}}}`}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
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
