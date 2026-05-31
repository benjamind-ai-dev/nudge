# Self-hosted fonts

Licensed font files are NOT committed (license restrictions). Drop the `.woff2`
files here with these exact names — `src/index.css` `@font-face` rules point at them:

| File | Family | Weight |
|---|---|---|
| `ABCDiatype-Regular.woff2` | ABC Diatype | 400 |
| `ABCDiatype-Medium.woff2` | ABC Diatype | 500 |
| `ABCDiatype-Bold.woff2` | ABC Diatype | 700 |
| `Items-Light.woff2` | Items Light | 300 (Light) |

Vite serves `public/` at the site root, so they resolve as `/fonts/<file>.woff2`.

Usage:
- **ABC Diatype** (`--font-sans`) — body, UI, buttons, labels, all interface copy.
- **Items Light** (`--font-display`) — large hero/onboarding display titles only. Not body.
- `--font` is a runtime override hook on `--font-sans` (set on `:root`/a brand wrapper to re-skin without rebuild).

Until the files are added, the fallback stack (`ui-sans-serif, system-ui`) renders.
