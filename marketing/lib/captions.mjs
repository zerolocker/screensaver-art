// Caption copy for the social clips — shared by the asset engine (which writes a
// human-readable captions.md) and the poster (which sends the same strings to
// the four platforms).
//
// WHY THE VARIANT POOLS: this runs every night, forever. One fixed template per
// platform would publish the same sentence 365 times a year on the same account,
// which reads as spam to both people and platforms. So each line is drawn from a
// small pool, keyed by a hash of the piece + platform: no randomness (a re-run
// produces the identical caption, which keeps posting idempotent and lets a
// failed post be retried byte-for-byte), but no two consecutive nights look
// alike either. Upgrading these to a per-piece Gemini call is the "agentic
// layer" in strategy §11 (C) — the pools are the cheap 90%.

import { landingUrl, SITE } from './pieces.mjs'

/** djb2 — the same tiny stable hash the cache layer uses. Deterministic picks. */
function hash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return h
}

const pick = (pool, key, salt) => pool[hash(`${key}::${salt}`) % pool.length]

/** "Art Nouveau" -> "an Art Nouveau"; "Baroque" -> "a Baroque". */
const article = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a')

const HOOKS = [
  (t, s) => `${t} — ${s}, brought to life.`,
  (t, s) => `POV: your screensaver is ${article(s)} ${s} gallery.`,
  (t, s) => `${t}. ${s}, and it moves.`,
  (t, s) => `${article(s) === 'an' ? 'An' : 'A'} ${s} piece that doesn't sit still: ${t}.`,
  (t, s) => `${t} — what ${s} looks like when it breathes.`,
  (t) => `Nobody expects the screensaver to be the best thing on the desk. ${t}.`,
]

const BODIES = [
  'A new curated piece arrives on your Mac every day.',
  'This is a Mac screensaver. A different piece lands every day.',
  'Your Mac, doing nothing, beautifully — a new work daily.',
  'One new animated piece a day, playing when you step away.',
]

const CTAS = [
  (url) => `Free to try on Mac → ${url}`,
  (url) => `Turn your screensaver into a gallery → ${url}`,
  (url) => `See it move on your own Mac → ${url}`,
  (url) => `New art every day, free to start → ${url}`,
]

const BASE_TAGS = ['screensaver', 'livewallpaper', 'aiart', 'digitalart', 'macsetup', 'desksetup', 'aesthetic']
const TAIL_TAGS = {
  instagram: ['reels', 'artreel', 'interiordesign'],
  tiktok: ['arttok', 'fyp', 'satisfying'],
  youtube: ['shorts', 'aivideo'],
  pinterest: ['wallpaper', 'aestheticwallpaper'],
}

const styleTag = (style) => style.toLowerCase().replace(/[^a-z0-9]+/g, '')

function hashtags(style, platform) {
  const tags = [...BASE_TAGS, styleTag(style), ...(TAIL_TAGS[platform] || [])]
  return [...new Set(tags.filter(Boolean))].map((t) => `#${t}`).join(' ')
}

const clamp = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`)

/**
 * Every string the four platforms need for one piece.
 *
 * Each platform gets its OWN landing URL, differing only in `utm_source`, so
 * traffic can be attributed per channel. The destination is always the piece's
 * own `/art/<slug>` page — never the homepage — because that page shows this
 * exact clip and offers the download, and because a post's link can't be edited
 * after publishing.
 */
export function buildCaptions({ title, style, webSlug }) {
  const key = webSlug || title
  const hook = pick(HOOKS, key, 'hook')(title, style)
  const body = pick(BODIES, key, 'body')

  const forPlatform = (platform) => {
    const url = landingUrl(webSlug, platform)
    return { url, cta: pick(CTAS, key, `cta:${platform}`)(url), tags: hashtags(style, platform) }
  }

  const ig = forPlatform('instagram')
  const tt = forPlatform('tiktok')
  const yt = forPlatform('youtube')
  const pin = forPlatform('pinterest')

  return {
    instagram: {
      // One field: IG's caption is the whole post.
      text: `${hook}\n${body}\n${ig.cta}\n.\n${ig.tags}`,
      url: ig.url,
    },
    tiktok: {
      text: `${hook}\n${body}\n${tt.cta}\n${tt.tags}`,
      url: tt.url,
    },
    youtube: {
      // YouTube's title is a real title, not a caption — keep it under the 100
      // char limit and put the sell in the description.
      title: clamp(`${title} — ${style}, animated`, 90),
      description: `${hook}\n\n${body}\n${yt.cta}\n\n${yt.tags}`,
      tags: [styleTag(style), 'screensaver', 'aiart', 'macsetup', 'livewallpaper'].filter(Boolean),
      url: yt.url,
    },
    pinterest: {
      // Pin titles are searched; the link is the whole point of a pin.
      title: clamp(`${title} — animated ${style} art for your Mac`, 100),
      description: clamp(`${body} ${pin.cta}\n${pin.tags}`, 480),
      link: pin.url,
      url: pin.url,
    },
  }
}

/** The human-facing starter file written next to the rendered clips. */
export function captionsMarkdown({ title, style, webSlug }) {
  const c = buildCaptions({ title, style, webSlug })
  const landing = webSlug ? `\`/art/${webSlug}\`` : 'the home page (no gallery entry for this source)'
  return `# Social captions — ${title}

_These are exactly the strings \`post-social.mjs\` publishes, so what you read here
is what went out. Each platform's link is the piece's own landing page (${landing})
with its own \`utm_source\`, so the four channels can be told apart in PostHog.
Copy is drawn from variant pools keyed by the piece — deterministic, but no two
nights read alike. Site: ${SITE}._

## Instagram Reels
\`\`\`
${c.instagram.text}
\`\`\`

## TikTok
\`\`\`
${c.tiktok.text}
\`\`\`

## YouTube Shorts
**Title:** \`${c.youtube.title}\`
\`\`\`
${c.youtube.description}
\`\`\`

## Pinterest
**Title:** \`${c.pinterest.title}\`
**Link:** ${c.pinterest.link}
\`\`\`
${c.pinterest.description}
\`\`\`
`
}
