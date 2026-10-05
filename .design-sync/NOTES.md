# design-sync notes

The synced design system ("Design System", project id `b8825019-8e89-4c5f-8675-c12cd23d9910`) combines:
- `living-art-screensaver-web/components/ui/`: the shadcn/Radix components the website uses. These are the primitives.
- `packages/ui/`: four product components with no shadcn equivalent (`OtpForm`, `OAuthButtons`, `SubscriptionCard`, `FeedbackForm`). Its own Button, Card, Input, Label and Textarea are dropped as duplicates.
- Brand tokens (dark background, mint `--primary`, Inter / Playfair Display / Geist Mono), identical in the three `globals.css` files under `packages/ui/src`, `living-art-screensaver-web/app` and `electron-app/src/renderer/src`.

Ignore `living-art-screensaver-web/styles/globals.css` (a leftover light-mode shadcn default). The Electron renderer adds no reusable components. `design_sys_inspo/DESIGN_SYSTEM.md` is design inspiration, useful only for judging whether something looks on-brand.

`conventions.md` is the usage guide shown to design agents (via `readmeHeader`). On re-sync, fix any class or token name that stops resolving; don't rewrite the prose.

## The synthetic package

The converter needs one buildable package, and neither source is one. `.design-sync/gen-synth.mjs` generates `living-art-screensaver-web/.lart-ds-synth/` (gitignored):
- `module: src/all.ts` re-exports every file, so all Radix subcomponents land on `window.LivingArt`.
- `types: src/index.ts` names only the top-level components, for a clean component list.
- It sits under the website so ts-morph finds the website's `node_modules` and extracts real props.

Edit `gen-synth.mjs` to add, remove, regroup or rename components. Its renames: `chart`→`ChartContainer`, `input-otp`→`InputOTP`, `resizable`→`ResizablePanelGroup`, `sonner`→`Toaster`. The Radix `toast` trio is excluded (unused, and it collides with sonner's `Toaster`).

## Build

Always regenerate the synthetic package and recompile Tailwind first, or the build uses stale files. From the repo root:

```bash
node .design-sync/gen-synth.mjs
node .ds-sync/node_modules/@tailwindcss/cli/dist/index.mjs \
  -i .ds-sync/tw-input.css -o living-art-screensaver-web/.lart-ds-synth/ds-styles.css
node .ds-sync/package-build.mjs --config .design-sync/config.json \
  --node-modules living-art-screensaver-web/node_modules \
  --entry living-art-screensaver-web/.lart-ds-synth/src/all.ts --out ./ds-bundle
node .ds-sync/package-validate.mjs ./ds-bundle
node .ds-sync/package-capture.mjs --out ./ds-bundle
```

- The components are styled only with Tailwind utility classes, so the CSS must be compiled. `tw-input.css` is: `@import "tailwindcss" source(none);`, `@import "tw-animate-css";`, three `@source "<abs path>"` lines (for `components/ui`, `packages/ui/src` and `.design-sync/previews`), then `app/globals.css` without its first two lines. Regenerate it when `app/globals.css` changes.
- Fonts ship from `.design-sync/fonts/brand-fonts.css`. The `--font-inter` / `--font-playfair` `[TOKENS_MISSING]` warnings are expected.
- `.ds-sync/` (gitignored) needs esbuild, ts-morph, @types/react, typescript, @tailwindcss/cli@4.2.2, tw-animate-css and playwright with chromium.

## Hand-written overrides

- **Props** (`dtsPropsFor`): `SubscriptionCard`, `ChartContainer` and `Carousel` reference external types that aren't inlined. `OtpForm`, `OAuthButtons` and `FeedbackForm` lost their required callbacks in extraction.
- **Overlays** (Dialog, AlertDialog, Drawer, Sheet, Popover, HoverCard, Tooltip, DropdownMenu, Menubar, Select, NavigationMenu) use `cardMode: single` with a fixed viewport so they render open. `Tooltip` previews need `TooltipProvider`, `Sidebar` needs `SidebarProvider`, `Form` uses `useForm()`. `ContextMenu` only shows its trigger.

Known cosmetic quirks: modal previews show a grey band below the modal, the `Toaster` preview may not show its toasts, and the `ResizablePanelGroup` text slightly overflows its border.

## Grades

Refreshing `.ds-sync/` from the skill can bump `KEY_RECIPE` in `lib/sync-hashes.mjs`, which clears every cached grade in `.design-sync/.cache/review/`. To recover, look at the contact sheets in `ds-bundle/_screenshots/`, write the grades again, and rerun `package-capture`. `.design-sync/.cache/gen-grades.mjs` marks everything good without looking; only use it after actually checking the sheets.
