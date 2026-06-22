import { Search } from "lucide-react";
import { cn } from "../../lib/utils";
import type { BucketFilter } from "../../pages/reports/reports.view-model";
import type { InvoiceStatus } from "../../api/invoices.api";

interface ReportFilterBarProps {
  bucket: BucketFilter;
  bucketOptions: { value: BucketFilter; label: string }[];
  onBucketChange: (b: BucketFilter) => void;

  customerSearch: string;
  onCustomerSearchChange: (v: string) => void;

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
      {/* Bucket chips */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-[#C5C6CF] bg-white p-1 shadow-sm">
        {props.bucketOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => props.onBucketChange(opt.value)}
            className={cn(
              "whitespace-nowrap rounded-md px-4 py-1.5 text-sm transition-colors",
              props.bucket === opt.value
                ? "bg-[#041534] font-semibold text-white"
                : "font-medium text-[#45464E] hover:bg-[#EEEEEE]",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Customer search (filters the loaded page) */}
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#75777F]" />
        <input
          type="text"
          value={props.customerSearch}
          onChange={(e) => props.onCustomerSearchChange(e.target.value)}
          placeholder="Filter by customer name…"
          className="w-full rounded-lg border border-[#C5C6CF] bg-white py-2 pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0B61A1]/20"
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
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
        </div>
        <div className="relative">
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
      </div>
    </section>
  );
}
