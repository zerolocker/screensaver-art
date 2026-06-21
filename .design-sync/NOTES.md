# design-sync notes — Living Art UI

## What this design system is
The DS spans three places in this monorepo, unified into ONE synced library:
- `living-art-screensaver-web/components/ui/` — 53 shadcn/Radix components (the
  de-facto DS the website renders). The canonical primitives.
- `packages/ui/` (`@screensaver-art/ui`) — 4 product-unique components with no
  shadcn equivalent: `OtpForm`, `OAuthButtons`, `SubscriptionCard`, `FeedbackForm`.
  (Its Button/Card/Input/Label/Textarea are DROPPED as duplicates — the website
  versions win; identical brand tokens, richer variants.)
- Brand tokens (dark bg + **mint-green** `--primary: oklch(0.85 0.15 145)`,
  Inter/Playfair/Geist Mono) live identically in three `globals.css` files
  (`packages/ui/src`, `living-art-screensaver-web/app`, `electron-app/src/renderer/src`).
- The Electron renderer adds NO new primitives (it imports `@screensaver-art/ui`
  + product compositions tied to IPC/canvas — not reusable, deliberately excluded).
- `living-art-screensaver-web/styles/globals.css` is a LEFTOVER light-mode shadcn
  default — NOT the brand. Ignore it.
- `living-art-screensaver-web/design_sys_inspo/DESIGN_SYSTEM.md` = Kaiber
  inspiration (design intent, not code). Useful for grading on-brand-ness only.

Total synced: **57 components**, grouped forms/overlays/navigation/data-display/feedback/product.

## The synthetic-package trick (why + how)
Neither root is an installable package (the website is a Next app named
`my-project`; `packages/ui` has no build). The converter needs ONE package with a
build. So `.design-sync/gen-synth.mjs` generates a synthetic re-export package at
`living-art-screensaver-web/.lart-ds-synth/` (gitignored):
- `package.json` → `module: src/all.ts` (bundle entry — `export *` of every real
  file, so ALL Radix subcomponents land on `window.LivingArt`),
  `types: src/index.ts` (NAMED-exports only the ~57 top-level components → clean
  card list + clean `.d.ts`, no subexport explosion).
- `src/<group>/<Name>.tsx` → `export *` (website) or named re-export (product).
- Rooted UNDER the website so ts-morph's `node_modules` walk finds cva/Radix/
  `@types/react` → REAL prop extraction from source.
- To add/remove/regroup components or fix names, edit `gen-synth.mjs` and re-run it.

## Styling: Tailwind must be compiled
shadcn components style via Tailwind UTILITY classes — there's no shipped
stylesheet. `cfg.cssEntry` points at `.lart-ds-synth/ds-styles.css`, which is a
Tailwind v4 compile of `.ds-sync/tw-input.css` (= brand tokens from
`app/globals.css` + `@source` scans of `components/ui`, `packages/ui/src`, and
`.design-sync/previews`). **Recompile it before every build** (especially after
editing previews, so their utility classes are generated):
```
node .ds-sync/node_modules/@tailwindcss/cli/dist/index.mjs \
  -i .ds-sync/tw-input.css -o living-art-screensaver-web/.lart-ds-synth/ds-styles.css
```
`tw-input.css` recipe (regenerate if `app/globals.css` changes): header lines
`@import "tailwindcss" source(none);` + `@import "tw-animate-css";` + three
`@source "<abs path>"` lines, then `tail -n +3 app/globals.css` (drops its two
`@import` lines, keeps the token block).

## Fonts
`cfg.extraFonts` → `.design-sync/fonts/brand-fonts.css` ships Inter / Playfair
Display / Geist Mono woff2 (fontsource latin, OFL). `--font-inter`/`--font-playfair`
`[TOKENS_MISSING]` warnings are EXPECTED (next/font runtime vars; the @theme falls
back to the shipped `'Inter'`/`'Playfair Display'` families).

## Build + verify commands (run from repo root)
```
node .design-sync/gen-synth.mjs                       # (re)generate synthetic pkg
# recompile tailwind (see above)
node .ds-sync/package-build.mjs --config design-sync.config.json \
  --node-modules living-art-screensaver-web/node_modules \
  --entry living-art-screensaver-web/.lart-ds-synth/src/all.ts --out ./ds-bundle
node .ds-sync/package-validate.mjs ./ds-bundle
node .ds-sync/package-capture.mjs --out ./ds-bundle
```
`.ds-sync` deps installed: esbuild, ts-morph, @types/react, typescript,
@tailwindcss/cli@4.2.2, tw-animate-css, playwright (+ chromium). Helper scripts
in `.ds-sync` (gitignored): `gen-grades.mjs`, `introspect.mjs`, `dump-exports.mjs`.

## dtsPropsFor overrides (why each exists)
- `SubscriptionCard`, `ChartContainer`, `Carousel` — auto-extraction referenced
  external types not inlined (`Subscription`, `ChartConfig`, embla types) → hand-written.
- `OtpForm`, `OAuthButtons`, `FeedbackForm` — extraction missed required callbacks
  (`onRequestCode`/`onVerify`, `onSelect`, `onSubmit`) → hand-written full contract.

## Overlay overrides
Openable overlays use `cardMode:single` + a fixed `viewport` so the OPEN state
renders in-card (Dialog/AlertDialog/Drawer/Sheet/Popover/HoverCard/Tooltip/
DropdownMenu/Menubar/Select/NavigationMenu). `Tooltip` previews wrap in
`TooltipProvider`; `Sidebar` in `SidebarProvider`; `Form` uses `useForm()` from
react-hook-form. `ContextMenu` shows its TRIGGER only (opens on right-click — no
controllable `open` prop; can't render open statically).

## Known cosmetic notes (graded good, but if polishing later)
- Dialog/AlertDialog/Drawer/Sheet show a gray scrim band below the modal (the
  frame's minHeight ends before the viewport edge). Reads as a modal; harmless.
- `Toaster` card shows its mount + usage copy; the on-mount `toast()` calls don't
  reliably appear in the static screenshot (sonner enter animation/timing).
- `ResizablePanelGroup` right-panel text slightly overflows the rounded border.

## Re-sync risks (watch list)
- **`.lart-ds-synth/` is gitignored + regenerated** — always run `gen-synth.mjs`
  AND recompile tailwind before building, or the build runs against stale files.
- **Toast dedup**: the Radix `toast`/`toaster`/`use-toast` trio is intentionally
  EXCLUDED (unused dead scaffolding; collided with sonner's `Toaster`). If the
  site starts using Radix toasts, revisit `gen-synth.mjs`.
- **Component names**: `chart`→`ChartContainer`, `input-otp`→`InputOTP`,
  `resizable`→`ResizablePanelGroup`, `sonner`→`Toaster` (primary export ≠ filename).
- **Props quality depends on ts-morph resolving website `node_modules`** — keep
  the synthetic pkg rooted under the website. `@/` alias for `cn` doesn't resolve
  in ts-morph (harmless — `cn` isn't a prop).
- Fonts are pinned to fontsource `@latest` at download time — re-download is
  non-deterministic across major font releases (visually negligible).
- **Config moved** `design-sync.config.json` → `.design-sync/config.json` (skill's
  current path). `projectId` is now recorded: **`b8825019-8e89-4c5f-8675-c12cd23d9910`**
  ("Design System", owned by MoonlightSonata999). First upload completed 2026-06-19
  (302 files; all 57 components, render check clean, all graded good).
- **conventions.md authored** (`.design-sync/conventions.md`, wired via
  `readmeHeader`) — the design-agent usage header (dark-by-default theme, the
  Tailwind-utility→token table, fonts, providers). 3005 chars; every cited
  class/token/component was validated against the built `_ds_bundle.{css,js}`. On
  re-sync the driver re-validates it against the fresh build — fix any name that
  stops resolving; don't rewrite the prose.
- **Grade-cache wipe on a staged-script refresh (KEY_RECIPE bump):** re-copying
  `.ds-sync/` from the skill base can bump `lib/sync-hashes.mjs` `KEY_RECIPE`, which
  changes every component's `gradeKey`, so the next `package-capture` / driver run
  **clears all `.design-sync/.cache/review/*.grade.json`** (gitignored →
  unrecoverable) and marks everything `pendingGrade`. This happened on the
  2026-06-19 upload run (recipe → 7). Recovery: re-grade from the fresh render-check
  **contact sheets** (`ds-bundle/_screenshots/contact-sheet-*.png` — 4 sheets tile
  all 57), write `{cells:{...good...}}` keyed off each `<Name>.json` bookkeeping
  `cells` array, then re-run `package-capture` → expect "57 carried forward, 0
  cleared". `.design-sync/.cache/gen-grades.mjs` auto-writes all-good WITHOUT
  looking — only a shortcut; the skill wants the sheets actually viewed first.
