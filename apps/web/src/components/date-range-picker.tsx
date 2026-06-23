import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import type { DateRange as DayPickerRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

function toPickerRange(range: DateRange): DayPickerRange | undefined {
  if (!range.start) return undefined;
  return {
    from: parseIso(range.start),
    to: range.end ? parseIso(range.end) : undefined,
  };
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Due date",
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DayPickerRange | undefined>(
    toPickerRange(value),
  );

  const label = formatLabel(value);

  function handleOpenChange(next: boolean) {
    if (next) {
      // Sync draft when opening
      setDraft(toPickerRange(value));
    }
    setOpen(next);
  }

  function handleSelect(range: DayPickerRange | undefined) {
    setDraft(range);
  }

  function handleApply() {
    if (draft?.from) {
      onChange({
        start: toIso(draft.from),
        end: draft.to ? toIso(draft.to) : null,
      });
    } else {
      onChange({ start: null, end: null });
    }
    setOpen(false);
  }

  function handleClear() {
    setDraft(undefined);
  }

  function handleClearTrigger(e: React.MouseEvent) {
    e.stopPropagation();
    onChange({ start: null, end: null });
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "flex h-10 w-[260px] items-center gap-2 rounded-lg px-3 text-sm font-normal",
            !label && "text-muted-foreground",
            className,
          )}
        >
          <CalendarDays
            className={cn("h-5 w-5 shrink-0", label ? "text-muted-foreground" : "text-muted-foreground")}
          />
          <span className="flex-1 text-left">
            {label ?? placeholder}
          </span>
          {label && (
            <X
              className="h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={handleClearTrigger}
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-0"
        align="start"
        sideOffset={4}
      >
        <Calendar
          mode="range"
          selected={draft}
          onSelect={handleSelect}
        />
        <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
          >
            Clear
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
