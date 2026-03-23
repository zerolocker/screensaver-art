# Design System Inspiration — Kaiber UI

Reference screenshots from Kaiber's AI video generation workflow.
All crops are in this folder, named and numbered by element type.

---

## Color Palette

| Role | Value | Usage |
|---|---|---|
| Background | `#05090A` (near-black, very dark teal-black) | Page/panel background |
| Surface / Card | `#222228` (dark gray-purple) | Cards, upload areas, modal backgrounds |
| Primary Green | `#9EE8A2` (soft mint green) | Primary text, labels, slider thumbs, CTA backgrounds |
| Active Green (fill) | `#C2F0C5` (lighter mint) | Active/selected button fill, input highlight |
| Primary Purple | `#C5C3E8` (soft lavender) | Accent text, active tab pill, subject input highlight |
| Muted Purple | `#8C8AB8` | Secondary labels, "Learn more" links |
| Border / Outline | `#3A3A40` (dark gray) | Inactive button borders, card borders, dropdown borders |
| Border Active | `#6ED872` (green) | Active card border (e.g. Image Upload card when selected) |
| White | `#FFFFFF` | Body text in dark inputs |

---

## Typography

- **Font family**: System sans-serif, appears similar to Inter or a geometric sans
- **Weight usage**:
  - Section labels ("Evolve", "Model", "Motion", "Version"): regular weight, mint green
  - CTA button ("+Create Video"): medium/semibold, dark on green
  - Large prompt text: bold, large (~32px+ equivalent), mint green
  - Chip/tag text: regular, lavender-white
  - Banner text: regular, mint green on dark pill
- **Letter spacing**: Tight, minimal
- **All caps**: Used for section meta-labels only (e.g. "PROMPT", "SUBJECT")

---

## Components

### 01 — Navigation Bar (`01_nav_bar.png`)
- Full-width dark bar
- Logo on the far left (white/light)
- Nav links in the center (light text, hover underline implied)
- Right side: user icon, credit counter pill, CTA button
- Height: ~40px logical / ~80px retina
- Background blends into page background

### 02 — Primary CTA Button (`02_cta_button_green.png`)
- Shape: pill / fully-rounded rectangle
- Background: mint green (There's no gradient. The gradient in the screenshot doesn't belong to the button; it is there only because there's a different gradient element placed on top of this button.)
- Text: dark (near-black), medium weight, prefixed with `+`
- No border
- Size: compact, ~36px tall
- Usage: primary action, only one per view

### 03 — Upgrade Banner (`03_upgrade_banner.png`)
- Shape: pill, full-width of left panel
- Background: dark gray (`#1A1F22`)
- Border: subtle 1px dark border
- Icon: star/sparkle outline in mint green, left-aligned
- Text: mint green, regular weight
- Usage: upsell/informational nudge, not a button

### 04 — Slider (Evolve) (`04_slider_evolve.png`)
- Label: small mint-green text above, left-aligned (e.g. "Evolve")
- Number input box: square with rounded corners, mint-green border and text, dark fill
- Track: thin horizontal line, mint green
- Thumb: glowing circular mint-green dot (with subtle bloom/glow)
- Layout: number box left, track to the right
- Usage: numeric range control

### 05 — Dropdown (`05_dropdown_model.png`)
- Label: mint-green text above ("Model ⓘ")
- Select box: rounded rectangle, dark fill, dark border
- Text inside: mint green, left-aligned
- Chevron: mint green, right-aligned
- Width: ~280px equivalent

### 06 — Slider (Motion) (`06_slider_motion.png`)
- Same pattern as Evolve slider (04)
- Demonstrates reusable slider component across different settings

### 07 — Toggle Buttons / Segmented Control (`07_version_toggle.png`)
- Label: mint-green text + ⓘ icon + purple "Learn more" link
- Two pill buttons side by side
  - **Inactive**: dark background, rounded border (`#3A3A40`), mint-green text
  - **Active**: mint-green fill, dark text, fully rounded
- Shape: large border radius (~12px+)
- Usage: mutually exclusive option selection (e.g. version 2.0 vs 3.0)

### 08 — Prompt Text Display (`08_prompt_text.png`)
- Large, bold mint-green text on dark background
- No input box — plain text display of the AI prompt
- Line height: generous, ~1.4
- Font size: large (~28–36px logical)

### 09 — Hyperlink (`09_motion_brush_link.png`)
- Color: mint green
- Underline: always visible
- Secondary label: muted gray, smaller, inline ("optional")
- No hover state visible in screenshot

### 10 — Image Upload Card (`10_image_upload_card.png`)
- Shape: rounded rectangle with large radius
- Border: 2px mint-green border (glowing/active state shown)
- Background: dark card surface
- Header: small muted label "Image Upload", centered
- Content: preview image fills the card body
- Footer link: "Remove" in mint green, underlined
- Usage: drag-and-drop / click-to-upload area

### 11 — Prompt Section Header (`11_prompt_header.png`)
- All-caps label: "PROMPT", "SUBJECT" — white/light lavender
- Small, tight letter-spacing
- Usage: section divider label

### 12 — Subject Input (Purple Highlight) (`12_subject_input_purple.png`)
- Instructional lead text: "I want to create a video of" — white, regular
- Input highlight: solid lavender/purple background (`#C5C3E8` with opacity, or ~`#9190D4`)
- Input text: dark/black, bold, large
- No visible border on the highlight box — pure background color
- Arrow icon (←) to the right of the input, mint green

### 13 — Style Input (Green Highlight) (`13_style_input_green.png`)
- Instructional lead text: "in the style of" — white, regular
- Input highlight: mint green background (`#C2F0C5` or similar)
- Input text: dark/black, bold
- Cursor visible (blinking text cursor)
- Same layout pattern as subject input (12), different accent color

### 14 — Scene Pill / Active Tab (`14_scene1_pill.png`)
- Shape: rounded rectangle, full pill
- Background: lavender/purple (`#C5C3E8`)
- Text: dark, medium weight ("Scene 1")
- Usage: active tab indicator, scene selector

### 15 — Topic / Tag Chips (`15_tag_chips.png`)
- Shape: pill (large border-radius)
- Background: transparent / very dark
- Border: 1px, muted lavender-gray (`#5A5875`)
- Text: lavender-white, regular weight
- Wrapping: multi-row wrap layout
- Usage: preset topic suggestions, selectable options

### 16 — Style Preview Cards (`16_style_cards.png`)
- Shape: square with rounded corners
- Content: full-bleed image thumbnail
- Label: white text below each card
- Layout: horizontal row, equal width, with overflow scroll implied
- Usage: visual style picker / curated presets

### 17 — Image Upload Card (Compact) (`17_image_upload_card.png`)
- Same structure as component 10 but in secondary context (workflow2)
- Shows uploaded image preview inside the bordered card

---

## Spacing & Layout

- **Page background**: single dark color, no gradients
- **Two-column layout**: left panel (controls/inputs) | right panel (preview/output)
- **Gap between panels**: generous — roughly equal to one panel width
- **Section spacing**: each control group (label + input) separated by ~24–32px logical gap
- **Component padding**: controls have ~16px internal padding
- **Border radius scale**: small (8px) for inputs/dropdowns, large (24–9999px) for pills/buttons

---

## Design Principles Observed

1. **Dark-first**: Everything is designed on near-black; no light mode shown
2. **Single accent hue**: Mint green dominates functional UI; purple is used only for active/selected states and accent highlights
3. **Glow effects**: Slider thumbs and borders use a subtle bloom/glow, reinforcing the "generative AI" aesthetic
4. **Minimal chrome**: No drop shadows, no gradients on backgrounds — surfaces are flat dark
5. **Large, legible controls**: Sliders, buttons, and inputs are generously sized
6. **Color as state**: Green = active/primary; Purple = selected/input; Muted = inactive
7. **Whitespace**: Generous vertical spacing between control groups keeps the UI uncluttered
