import { Send } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";

export function SequencesPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-sm items-center text-center">
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Send className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-semibold text-foreground">Sequences</p>
            <p className="text-sm text-muted-foreground">
              Follow-up sequences are coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
