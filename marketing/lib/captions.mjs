// Caption text for the social clips, shared by make-social-assets.mjs (which
// writes captions.md) and post-social.mjs (which posts it). The rules behind it
// are in marketing/README.md ("Captions"). Everything depends only on the piece,
// so a retried post is identical.

import { artPhrase, artistMovement, artistShortName, artworkHashtags, pieceHashtags } from './hashtags.mjs'
import { SITE_ORIGIN, landingUrl } from './pieces.mjs'

/** What the app is, in as few words as a phone will show. */
const PITCH = 'Animated art screensaver app'

/** The first (on a phone, often the only visible) line of every IG / YouTube post. */
export const CAPTION = `${PITCH} - Link in bio`

/** TikTok's first line. Its link is in the pinned comment and, as plain text, the bio. */
const TIKTOK_CAPTION = `${PITCH} - Link in comment and bio`

/** Pinned under every TikTok video. */
const LINK_COMMENT = `Get the screensaver app: ${SITE_ORIGIN.replace(/^https?:\/\//, '')}`

/** The piece as the title pill names it, e.g. "The Street Food Stall · Contemporary Illustration". */
export const titleLine = (title, style) => `${title} · ${style}`

const clamp = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`)

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/** Distinct hashtags, first `max` of them, as one line. */
const hashtagLine = (tags, max) => [...new Set(tags)].slice(0, max).join(' ')

/** "Caillebotte's", "Rubens'" — for a name that may end in s. */
const possessive = (name) => (/s$/i.test(name) ? `${name}'` : `${name}'s`)

/**
 * The lead for a real artwork, naming the painting and the painter:
 * "Caillebotte's Paris Street; Rainy Day, brought to life".
 */
export function artworkLead(title, artwork) {
  const short = artistShortName(artwork.artist)
  return short ? `${possessive(short)} ${title}, brought to life` : `${title}, brought to life`
}

/** "Gustave Caillebotte, 1877 · Art Institute of Chicago · Public domain" */
export function artworkCreditLine(artwork) {
  return [
    [artwork.artist, artwork.originalDate].filter(Boolean).join(', '),
    artwork.museum,
    artwork.license === 'CC0' ? 'CC0' : 'Public domain',
  ].filter(Boolean).join(' · ')
}

/** Shorten `lead` until `lead + tail` fits in `max`. */
const fitWithTail = (lead, tail, max) => `${clamp(lead, max - tail.length)}${tail}`

/**
 * Captions for a real artwork: the same fixed first lines, then the painting,
 * painter and museum, with hashtags from the artist.
 */
function artworkCaptions({ title, era, webSlug, artwork }) {
  const lead = artworkLead(title, artwork)
  const credit = artworkCreditLine(artwork)
  const own = artworkHashtags({ artist: artwork.artist, era })
  const movement = artistMovement(artwork.artist)
  const phrase = movement ? null : artPhrase({ style: null, era })
  const body = `${lead}\n${credit}`
  return {
    instagram: { text: `${CAPTION}\n\n${body}\n${hashtagLine(['#screensaver', '#animatedart', ...own], 4)}` },
    tiktok: {
      text: `${TIKTOK_CAPTION}\n\n${body}\n${hashtagLine(['#screensaver', '#animatedart', ...own], 4)}`,
      linkComment: LINK_COMMENT,
    },
    youtube: {
      // Painting and painter, then as much of the fixed line as fits.
      title: `${lead} | ${CAPTION}`.length <= 100
        ? `${lead} | ${CAPTION}`
        : fitWithTail(lead, ' - Link in bio', 100),
      description: `${body}\n\n${hashtagLine([...own, '#animatedart'], 3)}`,
      tags: ['screensaver app', 'animated art', artwork.artist, title, movement, 'art history']
        .filter(Boolean).map((t) => t.replace(/[,<>]/g, '').trim()).filter(Boolean),
    },
    pinterest: {
      // Painting and painter first: that's what people search for.
      title: fitWithTail(`${title} by ${artwork.artist}, animated`, ' | Art screensaver app', 100),
      // Pinterest ranks a pin's words, so name the movement (or era) too.
      description: `${lead}. ${credit}.${movement ? ` ${movement}.` : phrase ? ` ${capitalize(phrase)}.` : ''} ` +
        'The real artwork, gently animated with AI for your screensaver by Living Art Screensaver, ' +
        'with a new piece every night.',
      link: landingUrl(webSlug, 'pinterest'),
    },
  }
}

/**
 * Every string the four platforms need for one piece. `era` is its gallery tag
 * ("Japanese", "Modern"…), or null for a clip rendered from outside the gallery.
 * `artwork` is a real artwork's provenance (`artworkOf` in lib/pieces.mjs), or
 * null for an AI piece.
 */
export function buildCaptions({ title, style, era = null, webSlug, artwork = null }) {
  if (artwork) return artworkCaptions({ title, era, webSlug, artwork })
  const piece = titleLine(title, style)
  const own = pieceHashtags({ style, era })
  const phrase = artPhrase({ style, era })
  return {
    instagram: { text: `${CAPTION}\n\n${piece}\n${hashtagLine(['#screensaver', '#animatedart', ...own], 4)}` },
    tiktok: {
      text: `${TIKTOK_CAPTION}\n\n${piece}\n${hashtagLine(['#screensaver', '#animatedart', ...own], 4)}`,
      linkComment: LINK_COMMENT,
    },
    youtube: {
      // The Shorts player shows the title, so the fixed line goes there. YouTube
      // shows up to three hashtags, so the piece's own come first.
      title: CAPTION,
      description: `${piece}\n\n${hashtagLine([...own, '#animatedart'], 3)}`,
      // YouTube splits tags on commas and rejects angle brackets.
      tags: ['screensaver app', 'animated art', style, title].map((t) => t.replace(/[,<>]/g, '').trim()).filter(Boolean),
    },
    pinterest: {
      // Style first: people search for styles, and search ranks the title.
      title: clamp(`Animated ${style}: ${title} | Art screensaver app`, 100),
      description: `${piece}. ${phrase ? `${capitalize(phrase)}, gently animated` : 'Gently animated art'} ` +
        'for your screensaver by Living Art Screensaver, with a new piece every night.',
      link: landingUrl(webSlug, 'pinterest'),
    },
  }
}

/** The human-facing record written next to the rendered clips. */
export function captionsMarkdown({ title, style, era = null, webSlug, artwork = null }) {
  const c = buildCaptions({ title, style, era, webSlug, artwork })
  const landing = webSlug ? `\`/art/${webSlug}\`` : 'the home page (no gallery entry for this source)'
  return `# Social captions — ${title}

_These are exactly the strings \`post-social.mjs\` publishes, so what you read here
is what went out. Instagram and YouTube lead with the same fixed line and leave
the linking to the profile's bio; TikTok's points at a pinned comment and the bio;
the pin links to ${landing}._

## Instagram Reels
\`\`\`
${c.instagram.text}
\`\`\`

## TikTok
\`\`\`
${c.tiktok.text}
\`\`\`
**Pinned comment:** \`${c.tiktok.linkComment}\`

## YouTube Shorts
**Title:** \`${c.youtube.title}\`
**Tags:** ${c.youtube.tags.join(', ')}
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
