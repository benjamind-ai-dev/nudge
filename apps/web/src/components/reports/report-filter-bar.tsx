import { Search } from "lucide-react";
import { DateRangePicker, type DateRange } from "../date-range-picker";
import type { InvoiceStatus } from "../../api/invoices.api";

interface ReportFilterBarProps {
  dateRange: DateRange;
  onDateRangeChange: (r: DateRange) => void;

  search: string;
  onSearchChange: (v: string) => void;

  status: "" | InvoiceStatus;
  statusOptions: { value: "" | InvoiceStatus; label: string }[];
  onStatusChange: (v: string) => void;

  sortValue: string;
  sortOptions: { value: string; label: string }[];
  onSortChange: (v: string) => void;
}

const SELECT_CLASS =
  "appearance-none rounded-lg border border-[#C5C6CF] bg-white px-4 py-2 pr-9 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0B61A1]/20";

export function ReportFilterBar(props: ReportFilterBarProps) {
  return (
    <section className="flex flex-wrap items-center gap-4">
      <DateRangePicker
        value={props.dateRange}
        onChange={props.onDateRangeChange}
        placeholder="Due date"
      />

      {/* Customer / invoice search (filters the loaded set) */}
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#75777F]" />
        <input
          type="text"
          value={props.search}
          onChange={(e) => props.onSearchChange(e.target.value)}
          placeholder="Search customer or invoice #…"
          className="w-full rounded-lg border border-[#C5C6CF] bg-white py-2 pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0B61A1]/20"
        />
      </div>

      <div className="flex items-center gap-3">
        <select
          value={props.status}
          onChange={(e) => props.onStatusChange(e.target.value)}
          className={SELECT_CLASS}
        >
          {props.statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={props.sortValue}
          onChange={(e) => props.onSortChange(e.target.value)}
          className={SELECT_CLASS}
        >
          {props.sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
