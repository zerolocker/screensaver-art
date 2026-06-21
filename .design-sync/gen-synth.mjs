// Generates a synthetic re-export package that unifies the two component roots
// (the website's shadcn library at components/ui + the product-unique pieces
// from @screensaver-art/ui) into ONE design-system package the design-sync
// converter can consume.
//
// Why a synthetic package:
//  - `module` → src/all.ts `export *`s every real file, so ALL exports
//    (incl. Radix subcomponents like DialogContent) land on window.LivingArt
//    for composition in previews.
//  - `types`  → src/index.ts NAMED-exports only the ~57 top-level components,
//    so the card list + .d.ts props stay clean (no subexport explosion).
//  - group dirs (src/<group>/<Name>.tsx) drive the DS-pane grouping via the
//    converter's path-based enrichment.
//  - rooted UNDER the website so ts-morph's node_modules walk finds cva/Radix/
//    @types/react → real prop extraction.
//
// Re-run: `node .design-sync/gen-synth.mjs`

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';

const REPO = '/Users/gavinkaiber/git/screensaver-art';
const WEB_UI = `${REPO}/living-art-screensaver-web/components/ui`;
const SYNTH = `${REPO}/living-art-screensaver-web/.lart-ds-synth`;

// name -> { group, file (real .tsx, web) | pkg (named re-export from a package) }
const web = (group, entries) =>
  Object.entries(entries).map(([name, file]) => ({ name, group, file: `${WEB_UI}/${file}` }));

const COMPONENTS = [
  ...web('forms', {
    Button: 'button.tsx', Input: 'input.tsx', Textarea: 'textarea.tsx', Label: 'label.tsx',
    Checkbox: 'checkbox.tsx', RadioGroup: 'radio-group.tsx', Switch: 'switch.tsx', Select: 'select.tsx',
    Slider: 'slider.tsx', Toggle: 'toggle.tsx', ToggleGroup: 'toggle-group.tsx', InputOTP: 'input-otp.tsx',
    InputGroup: 'input-group.tsx', ButtonGroup: 'button-group.tsx', Field: 'field.tsx', Form: 'form.tsx',
    Calendar: 'calendar.tsx',
  }),
  ...web('overlays', {
    Dialog: 'dialog.tsx', Drawer: 'drawer.tsx', Sheet: 'sheet.tsx', Popover: 'popover.tsx',
    HoverCard: 'hover-card.tsx', Tooltip: 'tooltip.tsx', DropdownMenu: 'dropdown-menu.tsx',
    ContextMenu: 'context-menu.tsx', Menubar: 'menubar.tsx', AlertDialog: 'alert-dialog.tsx', Command: 'command.tsx',
  }),
  ...web('navigation', {
    Tabs: 'tabs.tsx', Accordion: 'accordion.tsx', Breadcrumb: 'breadcrumb.tsx',
    NavigationMenu: 'navigation-menu.tsx', Pagination: 'pagination.tsx', Sidebar: 'sidebar.tsx',
    Collapsible: 'collapsible.tsx',
  }),
  ...web('data-display', {
    Table: 'table.tsx', Card: 'card.tsx', Avatar: 'avatar.tsx', Badge: 'badge.tsx', Separator: 'separator.tsx',
    AspectRatio: 'aspect-ratio.tsx', Carousel: 'carousel.tsx', ChartContainer: 'chart.tsx', Kbd: 'kbd.tsx',
    Item: 'item.tsx', Empty: 'empty.tsx', ScrollArea: 'scroll-area.tsx', ResizablePanelGroup: 'resizable.tsx',
  }),
  ...web('feedback', {
    Alert: 'alert.tsx', Progress: 'progress.tsx', Skeleton: 'skeleton.tsx', Spinner: 'spinner.tsx',
    Toaster: 'sonner.tsx',
  }),
  // Product-unique (no shadcn equivalent) — named re-export so the 5 duplicate
  // primitives in @screensaver-art/ui (Button/Card/Input/Label/Textarea) never
  // collide with the website set on the global.
  { name: 'OtpForm', group: 'product', pkg: '@screensaver-art/ui' },
  { name: 'OAuthButtons', group: 'product', pkg: '@screensaver-art/ui' },
  { name: 'SubscriptionCard', group: 'product', pkg: '@screensaver-art/ui' },
  { name: 'FeedbackForm', group: 'product', pkg: '@screensaver-art/ui' },
];

rmSync(SYNTH, { recursive: true, force: true });
mkdirSync(join(SYNTH, 'src'), { recursive: true });

for (const c of COMPONENTS) {
  const f = join(SYNTH, 'src', c.group, `${c.name}.tsx`);
  mkdirSync(dirname(f), { recursive: true });
  // website: export * (carries subcomponents); product: named re-export.
  const body = c.file
    ? `export * from ${JSON.stringify(c.file)};\n`
    : `export { ${c.name} } from ${JSON.stringify(c.pkg)};\n`;
  writeFileSync(f, body);
}

// all.ts — the bundle entry: everything on window.LivingArt.
writeFileSync(
  join(SYNTH, 'src', 'all.ts'),
  COMPONENTS.map((c) => `export * from ${JSON.stringify(`./${c.group}/${c.name}`)};`).join('\n') + '\n',
);
// index.ts — the types/card-list entry: exactly the top-level components.
writeFileSync(
  join(SYNTH, 'src', 'index.ts'),
  COMPONENTS.map((c) => `export { ${c.name} } from ${JSON.stringify(`./${c.group}/${c.name}`)};`).join('\n') + '\n',
);
writeFileSync(
  join(SYNTH, 'package.json'),
  JSON.stringify({ name: 'living-art-ui', version: '1.0.0', private: true, module: 'src/all.ts', types: 'src/index.ts' }, null, 2) + '\n',
);

const byGroup = {};
for (const c of COMPONENTS) (byGroup[c.group] ??= []).push(c.name);
console.log(`Generated ${COMPONENTS.length} components at ${SYNTH}`);
for (const [g, names] of Object.entries(byGroup)) console.log(`  ${g} (${names.length}): ${names.join(', ')}`);
