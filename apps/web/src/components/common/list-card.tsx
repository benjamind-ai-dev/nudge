import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Shared "entity list" primitives — the Card + count-header + icon-avatar row
 * pattern used by the Templates and Sequences lists. Keeps both lists visually
 * identical from one source. Each feature supplies its own row `right` slot
 * (meta + hover actions) and its own state content.
 */

export function ListCard({ children }: { children: ReactNode }) {
  return <Card className="gap-0 py-0">{children}</Card>;
}

export function ListCardHeader({
  label,
  count,
  noun,
}: {
  label: string;
  count: number;
  noun: string;
}) {
  return (
    <div className="flex items-center justify-between border-b px-[18px] py-[14px]">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <span className="text-sm text-muted-foreground">
        {count} {count === 1 ? noun : `${noun}s`}
      </span>
    </div>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  right,
  onClick,
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3.5 border-b px-[18px] py-[15px] last:border-b-0 hover:bg-accent/40",
        onClick && "cursor-pointer",
      )}
    >
      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[9px] bg-accent text-accent-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="truncate text-[12.5px] text-muted-foreground">{subtitle}</div>
      </div>
      {right}
    </div>
  );
}

/** Card-wrapped loading skeleton (N pulsing rows). */
export function ListSkeletonCard({ rows = 4 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="space-y-2 px-6 py-6">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </CardContent>
    </Card>
  );
}

/** Card-wrapped centered message — used for error and empty states. */
export function ListMessageCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className={cn("px-6 py-12", className)}>{children}</CardContent>
    </Card>
  );
}
