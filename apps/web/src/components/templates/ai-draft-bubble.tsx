import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AiDraftBubbleProps {
  description: string;
  onDescriptionChange: (v: string) => void;
  onGenerate: () => Promise<void> | void;
  isGenerating: boolean;
}

export function AiDraftBubble({
  description,
  onDescriptionChange,
  onGenerate,
  isGenerating,
}: AiDraftBubbleProps) {
  const [justDrafted, setJustDrafted] = useState(false);

  async function handleClick() {
    if (!description.trim() || isGenerating) return;
    try {
      await onGenerate();
      setJustDrafted(true);
    } catch {
      // the view model already surfaces the error; don't show false success
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Draft with AI"
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        className="w-80 p-0"
      >
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Draft with AI
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Describe the email and we&apos;ll write it for you.
          </p>
        </div>
        <div className="space-y-2.5 p-4">
          <Textarea
            value={description}
            onChange={(e) => { setJustDrafted(false); onDescriptionChange(e.target.value); }}
            rows={8}
            className="min-h-44 resize-none text-sm"
            placeholder="e.g. a polite first reminder, warm but clear about the due date"
          />
          <Button
            className="w-full"
            onClick={handleClick}
            disabled={isGenerating || !description.trim()}
          >
            {isGenerating ? "Drafting…" : justDrafted ? "Regenerate" : "Generate"}
          </Button>
          {justDrafted && !isGenerating && (
            <p className="text-xs text-muted-foreground">
              Drafted — review it on the left. Tweak the description and regenerate to refine.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
