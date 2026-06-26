import { Badge } from "@/components/ui/badge";

interface SequenceStatusBadgeProps {
  isActive: boolean;
}

export function SequenceStatusBadge({ isActive }: SequenceStatusBadgeProps) {
  return isActive ? (
    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600">
      Active
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Paused
    </Badge>
  );
}
