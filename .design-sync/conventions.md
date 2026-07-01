# Living Art UI — usage conventions

A React design system (shadcn/Radix primitives + product components). Every component
is exported on `window.LivingArt.*` and styled with **Tailwind utility classes** bound
to the design tokens below.

## Theme: dark by default
The brand theme lives on `:root` — a near-black canvas with a mint-green accent. **Do
not add a `.dark` wrapper or a theme provider for color**; tokens apply automatically.
- Canvas `--background` oklch(0.08 0 0) (near-black), text `--foreground` oklch(0.98 0 0).
- Surfaces `--card`/`--popover` oklch(0.12 0 0); `--secondary`/`--muted`/`--accent` are
  dark grays (oklch ~0.18–0.20).
- **Accent `--primary` oklch(0.865 0.121 145.7) — mint green** (also `--ring`). This is the
  one saturated color; use it for primary actions, focus rings, selected states.
- Corner radius `--radius` 0.625rem.

## Styling idiom: Tailwind utilities → semantic tokens
Never hardcode hex/oklch in a design — compose with these utilities (each maps to a token,
so the dark+mint brand stays consistent):

| Utility | Token | Use for |
|---|---|---|
| `bg-background` / `text-foreground` | canvas + body text | page shell |
| `bg-card` / `text-card-foreground` | raised surface | cards, panels |
| `bg-primary` / `text-primary-foreground` | mint accent | primary buttons, key CTAs |
| `bg-secondary` / `bg-muted` / `bg-accent` | dark grays | secondary surfaces, hovers |
| `text-muted-foreground` | dimmed text | captions, helper text |
| `bg-destructive` | red | destructive actions |
| `border-border` / `border-input` | hairline borders | dividers, field outlines |
| `ring-ring` | mint focus ring | focus states |
| `rounded-lg` / `rounded-md` | `--radius` scale | corners |

## Fonts (shipped with the bundle)
- `font-sans` → **Inter** — default body/UI text.
- `font-serif` → **Playfair Display** — editorial display headings (the brand's
  expressive accent; use sparingly for hero titles).
- `font-mono` → **Geist Mono** — code, OTP codes, numeric data.

## Providers (only these need wrapping)
Color needs no provider, but a few interactive primitives read React context:
- `Tooltip` — wrap the tree (or trigger) in `LivingArt.TooltipProvider`.
- `Sidebar` and its parts — wrap in `LivingArt.SidebarProvider`.
- `Form` — driven by `react-hook-form` (`useForm()`); compose `Form` + `FormField` per the
  component's `.prompt.md`.
Everything else renders standalone.

## Where the truth lives
- `styles.css` is the style entry — it `@import`s `fonts/fonts.css` and `_ds_bundle.css`
  (all tokens + component CSS). Read it before styling.
- Per-component API + usage: `components/<group>/<Name>/<Name>.prompt.md` and `.d.ts`.

## Idiomatic example
```tsx
<div className="bg-background text-foreground p-8 rounded-lg">
  <h1 className="font-serif text-3xl">Living Art</h1>
  <p className="text-muted-foreground">Curated generative art, every day.</p>
  <LivingArt.Button className="mt-4">Subscribe</LivingArt.Button>
</div>
```
