import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "../lib/utils";

export interface DateRange {
  /** ISO date (yyyy-mm-dd), or null when unset. */
  start: string | null;
  end: string | null;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  className?: string;
}

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function sameDay(a: Date, b: Date): boolean {
  return toIso(a) === toIso(b);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function fmtDay(d: Date, withYear: boolean): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(d);
}

function formatLabel(range: DateRange): string | null {
  if (!range.start) return null;
  const start = parseIso(range.start);
  if (!range.end) return fmtDay(start, true);
  const end = parseIso(range.end);
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${fmtDay(start, !sameYear)} – ${fmtDay(end, true)}`;
}

interface DayCell {
  date: Date;
  inMonth: boolean;
}

function buildGrid(viewMonth: Date): DayCell[] {
  const first = startOfMonth(viewMonth);
  const leading = first.getDay();
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(first.getFullYear(), first.getMonth(), i - leading + 1);
    cells.push({ date, inMonth: date.getMonth() === viewMonth.getMonth() });
  }
  return cells;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Due date",
  className,
}: DateRangePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  const [viewMonth, setViewMonth] = useState<Date>(
    value.start ? startOfMonth(parseIso(value.start)) : startOfMonth(new Date()),
  );

  // Sync the draft + visible month each time the popover opens.
  useEffect(() => {
    if (open) {
      setDraft(value);
      setViewMonth(
        value.start ? startOfMonth(parseIso(value.start)) : startOfMonth(new Date()),
      );
    }
  }, [open, value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const today = useMemo(() => new Date(), []);
  const grid = useMemo(() => buildGrid(viewMonth), [viewMonth]);
  const label = formatLabel(value);

  const draftStart = draft.start ? parseIso(draft.start) : null;
  const draftEnd = draft.end ? parseIso(draft.end) : null;

  function pickDay(date: Date) {
    if (!draftStart || (draftStart && draftEnd)) {
      setDraft({ start: toIso(date), end: null });
    } else if (date < draftStart) {
      setDraft({ start: toIso(date), end: toIso(draftStart) });
    } else {
      setDraft({ start: toIso(draftStart), end: toIso(date) });
    }
  }

  function clearTrigger(e: React.MouseEvent) {
    e.stopPropagation();
    onChange({ start: null, end: null });
  }

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(viewMonth);

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-10 w-[260px] items-center gap-2 rounded-lg border bg-white px-3 transition-colors",
          open
            ? "border-2 border-[#0B61A1] px-[11px] shadow-[0_0_0_4px_rgba(11,97,161,0.1)]"
            : "border-[#C5C6CF] hover:border-[#0B61A1]",
        )}
      >
        <CalendarDays
          className={cn("h-5 w-5 shrink-0", label ? "text-[#45464E]" : "text-[#75777F]")}
        />
        <span
          className={cn(
            "flex-1 text-left text-sm",
            label ? "text-[#1A1C1C]" : "text-[#75777F]",
          )}
        >
          {label ?? placeholder}
        </span>
        {label && (
          <X
            className="h-4 w-4 shrink-0 text-[#75777F] hover:text-[#45464E]"
            onClick={clearTrigger}
          />
        )}
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute z-20 mt-2 w-[320px] overflow-hidden rounded-xl border border-[#C5C6CF] bg-white shadow-md">
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() =>
                setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
              }
              className="rounded-full p-1 transition-colors hover:bg-[#EEEEEE]"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-[#1A1C1C]">{monthLabel}</span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() =>
                setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
              }
              className="rounded-full p-1 transition-colors hover:bg-[#EEEEEE]"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 px-2">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="py-1 text-center text-[11px] font-bold text-[#75777F]"
              >
                {w}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 px-2 pb-4 text-sm">
            {grid.map(({ date, inMonth }) => {
              if (!inMonth) {
                return (
                  <div
                    key={toIso(date)}
                    className="flex h-9 items-center justify-center text-[#75777F]"
                  >
                    {date.getDate()}
                  </div>
                );
              }

              const isStart = draftStart && sameDay(date, draftStart);
              const isEnd = draftEnd && sameDay(date, draftEnd);
              const isMid =
                draftStart &&
                draftEnd &&
                date > draftStart &&
                date < draftEnd;
              const isToday = sameDay(date, today);
              const isEndpoint = isStart || isEnd;
              const hasRange = Boolean(draftStart && draftEnd);

              return (
                <button
                  type="button"
                  key={toIso(date)}
                  onClick={() => pickDay(date)}
                  className="relative flex h-9 items-center justify-center"
                >
                  {/* Range band */}
                  {isMid && <div className="absolute inset-0 bg-[#D9E2FF]" />}
                  {hasRange && isStart && (
                    <div className="absolute inset-y-0 right-0 w-1/2 bg-[#D9E2FF]" />
                  )}
                  {hasRange && isEnd && (
                    <div className="absolute inset-y-0 left-0 w-1/2 bg-[#D9E2FF]" />
                  )}
                  <span
                    className={cn(
                      "relative z-10 flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                      isEndpoint
                        ? "bg-[#0B61A1] font-medium text-white"
                        : isMid
                          ? "text-[#041534]"
                          : isToday
                            ? "border border-[#0B61A1] text-[#1A1C1C]"
                            : "text-[#1A1C1C] hover:bg-[#EEEEEE]",
                    )}
                  >
                    {date.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[#C5C6CF] bg-[#F9F9F9] p-3">
            <button
              type="button"
              onClick={() => setDraft({ start: null, end: null })}
              className="rounded px-3 py-2 text-xs font-semibold text-[#0B61A1] transition-colors hover:bg-[#0B61A1]/5"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
              className="rounded-lg bg-[#0B61A1] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
