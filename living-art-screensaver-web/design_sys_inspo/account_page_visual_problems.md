# Account Page Visual Problems

## Issues Observed (as of 2026-03-21)

### 1. Navbar inconsistency
The account page uses a plain serif text "Living Art" wordmark with no logo icon, while the homepage has the green icon + wordmark combo. The account header also omits the nav links (Features, Art Styles, Pricing) entirely — it becomes a completely different nav.

### 2. Red/orange border glow
There's a faint reddish/orange glow around the entire viewport on the account page that doesn't match the green brand color used throughout the rest of the site.

### 3. "Manage Subscription" button — low visual weight
Currently uses `variant="outline"` — a dark background, subtle border, no fill. On the dark card background this button is nearly invisible and doesn't read as actionable. It should use the primary green filled style (matching the homepage CTA) with a pill/rounded-full shape.

### 4. "Living Art Screensaver" plan box
The bordered dark box looks like a disabled input field rather than a product highlight. Needs a stronger visual treatment — e.g. a subtle green tint or a more intentional card-within-card design.

### 5. "Active" badge — missing pill treatment
The green circle checkmark next to "Active" is floating loosely. A proper pill/badge treatment (e.g. green filled chip) would make the status clearer at a glance.

### 6. Account Details — icon circles lack contrast
The email and calendar icon circles (`bg-muted`) are nearly the same dark tone as the card background. They disappear instead of providing visual anchoring.

### 7. macOS App Instructions — no visual hierarchy
The numbered list is plain dim text. Steps should be visually distinct — e.g. numbered badges, dividers, or a slightly elevated list style.

### 8. Layout — excessive empty space below cards
The two cards sit in the top portion of a `min-h-screen` background, leaving a large empty black void beneath. The page feels unfinished.

## Priority Fix
**Manage Subscription button**: change from `variant="outline"` to filled green primary style with `rounded-full` to match the design system's pill CTA pattern (see `02_cta_button_green.png`, `07_version_toggle.png` selected state).
