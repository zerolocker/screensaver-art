// Caption text for the social clips, shared by make-social-assets.mjs (which
// writes captions.md) and post-social.mjs (which posts it). A post shows one piece
// or a night's set stitched into one clip, so every caption takes the list of
// pieces and names each in order. The rules behind it are in marketing/README.md
// ("Captions"). Everything depends only on the pieces, so a retried post is identical.

import { artistMovement, artistShortName, artworkHashtags, pieceHashtags } from './hashtags.mjs'
import { SITE_ORIGIN, landingUrl } from './pieces.mjs'

/** What the app is, in as few words as a phone will show. */
const PITCH = 'Animated art screensaver app'

/** The first (on a phone, often the only visible) line of every IG / YouTube post. */
export const CAPTION = `${PITCH} - Link in bio`

/** TikTok's first line. Its link is in the pinned comment and, as plain text, the bio. */
const TIKTOK_CAPTION = `${PITCH} - Link in comment and bio`

/** Visible even where description URLs aren't clickable. */
const SITE_DOMAIN = SITE_ORIGIN.replace(/^https?:\/\//, '')

/** Pinned under every TikTok video. */
const LINK_COMMENT = `Get the screensaver app: ${SITE_DOMAIN}`

/** Each platform's text limits, in characters. */
const LIMIT = {
  instagram: 2200,
  tiktok: 2200,
  youtubeTitle: 100,
  youtubeDescription: 5000,
  youtubeTags: 500,
  pinTitle: 100,
  pinDescription: 500,
}

/** The piece as the title pill names it, e.g. "The Street Food Stall · Contemporary Illustration". */
export const titleLine = (title, style) => `${title} · ${style}`

/** What a post is called: its piece's title, or for a set the first piece's plus a count. */
export const postName = (pieces) =>
  pieces.length === 1 ? pieces[0].title : `${pieces[0].title} and ${pieces.length - 1} more`

const clamp = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`)

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

/** "Gustave Caillebotte, 1877 · Art Institute of Chicago". Full provenance stays on the art page. */
export function artworkCreditLine(artwork) {
  return [
    [artwork.artist, artwork.originalDate].filter(Boolean).join(', '),
    artwork.museum,
  ].filter(Boolean).join(' · ')
}

/** Shorten `lead` until `lead + tail` fits in `max`. */
const fitWithTail = (lead, tail, max) => `${clamp(lead, max - tail.length)}${tail}`

/** How a caption names one piece: its title and style, or a real artwork's title and credit. */
const pieceText = (p) =>
  (p.artwork ? `${p.title}\n${artworkCreditLine(p.artwork)}` : titleLine(p.title, p.style))

/** A piece's own hashtags, most specific first; a real artwork's come from its artist. */
const hashtagsOf = (p) => (p.artwork ? artworkHashtags({ artist: p.artwork.artist, era: p.era }) : pieceHashtags(p))

/**
 * The pieces' own hashtags, every piece's most specific one before any piece's
 * second, so a capped line shows the range of a set, not just its first piece.
 */
function ownHashtags(pieces) {
  const lists = pieces.map(hashtagsOf)
  const ranked = []
  for (let rank = 0; lists.some((tags) => rank < tags.length); rank++) {
    for (const tags of lists) if (rank < tags.length) ranked.push(tags[rank])
  }
  return [...new Set(ranked)]
}

/**
 * `render(lines)` with as many piece lines as fit in `max` characters, counting
 * the rest ("+2 more"). Only a very long set reaches a limit.
 */
function fit(max, lines, render) {
  for (let n = lines.length; n > 0; n--) {
    const text = render(n === lines.length ? lines : [...lines.slice(0, n), `+${lines.length - n} more`])
    if (text.length <= max) return text
  }
  return clamp(render(lines.slice(0, 1)), max)
}

/**
 * YouTube splits tags on commas, rejects angle brackets, and caps them at 500
 * characters in all, counting the quotes it adds around a tag with a space.
 */
function youtubeTags(pieces) {
  const words = pieces.flatMap((p) =>
    (p.artwork ? [p.artwork.artist, p.title, artistMovement(p.artwork.artist)] : [p.style, p.title]))
  const tags = [...new Set(
    ['screensaver app', 'animated art', ...words, ...(pieces.some((p) => p.artwork) ? ['art history'] : [])]
      .filter(Boolean).map((t) => t.replace(/[,<>]/g, '').trim()).filter(Boolean),
  )]
  const size = (list) => list.reduce((n, t) => n + t.length + (t.includes(' ') ? 2 : 0), list.length - 1)
  while (size(tags) > LIMIT.youtubeTags) tags.pop()
  return tags
}

/**
 * Every string the four platforms need for one post. `pieces` are in the order
 * the clip shows them, each `{ title, style, era, webSlug, artwork }`: `era` is
 * the gallery tag ("Japanese", "Modern"…) or null for a clip from outside the
 * gallery; `artwork` is a real artwork's provenance (`artworkOf` in
 * lib/pieces.mjs) or null for an AI piece. A post whose pieces are all real
 * artworks names the paintings and painters in its titles.
 */
export function buildCaptions(pieces) {
  const [first] = pieces
  const realArt = pieces.every((p) => p.artwork)
  const set = pieces.length > 1
  const texts = pieces.map(pieceText)
  const own = ownHashtags(pieces)
  const feedTags = hashtagLine(['#screensaver', '#animatedart', ...own], 4)
  const name = postName(pieces)
  const lead = realArt ? artworkLead(name, first.artwork) : null
  return {
    instagram: { text: fit(LIMIT.instagram, texts,
      (l) => `${CAPTION}\n${SITE_DOMAIN}\n\n${l.join('\n\n')}\n\n${feedTags}`) },
    tiktok: {
      text: fit(LIMIT.tiktok, texts,
        (l) => `${TIKTOK_CAPTION}\n${SITE_DOMAIN}\n\n${l.join('\n\n')}\n\n${feedTags}`),
      linkComment: LINK_COMMENT,
    },
    youtube: {
      // The Shorts player shows the title: for real art the painting and painter,
      // then as much of the fixed line as fits; else the fixed line, plus a set's
      // name. YouTube shows up to three hashtags, so the pieces' own come first.
      title: realArt
        ? (`${lead} | ${CAPTION}`.length <= LIMIT.youtubeTitle
          ? `${lead} | ${CAPTION}`
          : fitWithTail(lead, ' - Link in bio', LIMIT.youtubeTitle))
        : set ? clamp(`${CAPTION} · ${name}`, LIMIT.youtubeTitle) : CAPTION,
      description: fit(LIMIT.youtubeDescription, texts,
        (l) => `${CAPTION}\n${SITE_DOMAIN}\n\n${l.join('\n\n')}\n\n${hashtagLine([...own, '#animatedart'], 3)}`),
      tags: youtubeTags(pieces),
    },
    pinterest: {
      // Pin titles are what Pinterest search ranks, so they lead with what people
      // search for: the painting and painter, or the style. A set's pin links to
      // its first piece, so the title names that one.
      title: realArt
        ? fitWithTail(`${first.title} by ${first.artwork.artist}${set ? ` and ${pieces.length - 1} more` : ''}, animated`,
          ' | Art screensaver app', LIMIT.pinTitle)
        : clamp(`Animated ${first.style}: ${name} | Art screensaver app`, LIMIT.pinTitle),
      description: fit(LIMIT.pinDescription, texts,
        (l) => `${PITCH}\n${SITE_DOMAIN}\n\n${l.join('\n\n')}`),
      // Tagged with the channel so PostHog can attribute pin traffic.
      link: landingUrl(first.webSlug, 'pinterest'),
    },
  }
}

/** The human-facing record written next to the rendered clips. */
export function captionsMarkdown(pieces) {
  const c = buildCaptions(pieces)
  const { webSlug } = pieces[0]
  const page = webSlug ? `\`/art/${webSlug}\`` : 'the home page (no gallery entry for this source)'
  const landing = webSlug && pieces.length > 1 ? `${page}, the first piece's page` : page
  return `# Social captions — ${postName(pieces)}

_These are exactly the strings \`post-social.mjs\` publishes, so what you read here
is what went out. Every description shows the app pitch and website domain.
Instagram and YouTube point to the profile's bio; TikTok points to a pinned
comment and the bio; the pin links to ${landing}._

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
