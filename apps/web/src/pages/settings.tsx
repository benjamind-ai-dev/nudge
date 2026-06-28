import { Monitor, Moon, Sun } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { SyncDataCard } from "../components/settings/sync-data-card";
import { cn } from "../lib/utils";
import { useThemeStore, type ThemeMode } from "../stores/theme.store";
import { useSettingsViewModel } from "./settings.view-model";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function SettingsPage() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const vm = useSettingsViewModel();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-6 lg:px-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage how Nudge looks and works.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Theme</p>
              <p className="text-sm text-muted-foreground">
                Choose light, dark, or match your system.
              </p>
            </div>
            <div
              role="radiogroup"
              aria-label="Theme"
              className="inline-flex rounded-lg border border-border bg-muted/50 p-1"
            >
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
                const active = mode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMode(value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <SyncDataCard
        canResync={vm.canResync}
        isResyncing={vm.isResyncing}
        message={vm.resyncMessage}
        error={vm.resyncError}
        onResync={vm.resyncAllInvoices}
      />
    </div>
  );
}
