import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker, type DateRange } from "./date-range-picker";

// Radix Select does not allow an empty string as an item value.
// We use this sentinel internally and convert back to "" for the handler.
const ALL_SENTINEL = "__all__";

interface InvoiceFilterBarProps {
  dateRange: DateRange;
  onDateRangeChange: (r: DateRange) => void;

  search: string;
  onSearchChange: (v: string) => void;

  status: string;
  statusOptions: { value: string; label: string }[];
  onStatusChange: (v: string) => void;

  sortValue: string;
  sortOptions: { value: string; label: string }[];
  onSortChange: (v: string) => void;
}

export function InvoiceFilterBar(props: InvoiceFilterBarProps) {
  const statusSelectValue = props.status === "" ? ALL_SENTINEL : props.status;

  function handleStatusChange(v: string) {
    props.onStatusChange(v === ALL_SENTINEL ? "" : v);
  }

  return (
    <section className="flex flex-wrap items-center gap-4">
      <DateRangePicker
        value={props.dateRange}
        onChange={props.onDateRangeChange}
        placeholder="Due date"
      />

      {/* Customer / invoice search (filters the loaded set) */}
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={props.search}
          onChange={(e) => props.onSearchChange(e.target.value)}
          placeholder="Search customer or invoice #…"
          className="pl-10"
        />
      </div>

      <div className="flex items-center gap-3">
        <Select value={statusSelectValue} onValueChange={handleStatusChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {props.statusOptions.map((o) => (
              <SelectItem key={o.value === "" ? ALL_SENTINEL : o.value} value={o.value === "" ? ALL_SENTINEL : o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={props.sortValue} onValueChange={props.onSortChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {props.sortOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
