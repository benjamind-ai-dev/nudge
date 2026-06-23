/**
 * Navy brand panel for the onboarding split-screen (sign-up / sign-in /
 * billing / business-setup). Pure presentational. Hidden below `md`.
 *
 * The navy background (#1B2A4A) is intentional brand identity and kept as-is.
 * Inner accent dots/labels that referenced #2563EB are mapped to bg-primary
 * (indigo-600) so they stay in sync with the design token.
 */

const STEPS = [
  { label: "Day 0", tone: "accent" as const },
  { label: "Day 7", tone: "faded" as const },
  { label: "Day 14", tone: "faded" as const },
  { label: "Paid", tone: "accent" as const },
];

export function OnboardingBrandPanel() {
  return (
    <aside className="hidden w-[40%] max-w-[512px] flex-col justify-between bg-[#1B2A4A] p-12 md:flex">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-primary" />
        <span className="text-lg font-semibold tracking-tight text-white">
          Nudge
        </span>
      </div>

      {/* Visualization */}
      <div className="flex flex-col items-center">
        <div className="w-full max-w-[384px]">
          {/* Invoice card */}
          <div className="mb-10 w-40 rounded-lg border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur-sm">
            <div className="h-2 w-12 rounded bg-white/20" />
            <div className="mt-2 h-3 w-20 rounded bg-white/40" />
            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
              <div className="h-2 w-8 rounded bg-white/10" />
              <div className="h-2 w-10 rounded bg-primary" />
            </div>
          </div>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-0 right-0 top-[5px] h-px bg-white/20" />
            <div className="relative flex justify-between">
              {STEPS.map((s) => (
                <div key={s.label} className="flex flex-col items-center">
                  <span
                    className={
                      s.tone === "accent"
                        ? "h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-white/10"
                        : "h-2.5 w-2.5 rounded-full bg-white/40"
                    }
                  />
                  <span
                    className={
                      s.tone === "accent"
                        ? "mt-3 text-xs font-bold uppercase tracking-wider text-primary"
                        : "mt-3 text-xs font-medium uppercase tracking-wider text-white/60"
                    }
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-12 max-w-[320px] text-center text-sm leading-relaxed text-white/90">
          Nudge automatically follows up on overdue invoices.
        </p>
      </div>

      {/* Footer */}
      <nav className="flex gap-6">
        {["Privacy", "Terms", "Help"].map((l) => (
          <a
            key={l}
            href="#"
            className="text-[13px] text-white/60 transition-colors hover:text-white"
          >
            {l}
          </a>
        ))}
      </nav>
    </aside>
  );
}
