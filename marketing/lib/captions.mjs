// Caption copy for the social clips — shared by the asset engine (which writes a
// human-readable captions.md and burns the title pill) and the poster (which
// sends the same strings to the four platforms).
//
// A post shows one piece or a night's set stitched into one clip. Every caption
// takes a list of pieces and names each in order; a single piece is a list of one,
// and gets exactly the copy described below.
//
// ONE FIXED LINE, ON PURPOSE (founder call, 2026-09-12). Instagram and YouTube
// posts lead with the same short sentence, CAPTION below, and TikTok with the
// same pitch pointed at its pinned comment, TIKTOK_CAPTION. The clip
// itself carries no marketing text — a post that reads as an ad gets scrolled
// past, and words on screen pull attention off the art — so the caption is where
// a post quietly says this is an app, not an account that shares daily art.
//   - Short, because a phone shows a line or two before "more".
//   - No URL, because those three platforms don't make caption links clickable.
//     The profile's bio link does that job, or on TikTok the pinned comment.
//   - No "Mac", deliberately: interest from people on other platforms is a signal
//     worth seeing.
//
// Behind "more", each post names its piece in the same words as the title pill,
// so posts stay distinguishable to search. Repeating the first line nightly is
// not a duplicate to Zernio, which fingerprints the text and the media together.
//
// Pinterest is the exception. A pin is itself a link, to the piece's own
// /art/<slug> page, so it never says "Link in bio". Its title leads with the
// piece's style, because pin titles are what Pinterest search ranks and people
// search a style ("ukiyo-e"), not a piece's name. No hashtags there: Pinterest
// ranks the words in a pin, not its tags.
//
// HASHTAGS come from the piece itself (lib/hashtags.mjs): its movement and its
// era, where either has a real audience, after the two every post carries. Four
// at most on Instagram and TikTok (Instagram caps a post at five), and three in a
// YouTube description, the most YouTube shows beside the title.
//
// TikTok also gets LINK_COMMENT, which the poster comments under each video and
// pins. That account can't have a clickable bio link (it has no Business switch,
// and a personal account needs 1,000 followers), so its caption says "Link in
// comment and bio" (founder call, 2026-09-14): the pinned comment carries the
// address, and the bio carries it as plain text. TikTok makes neither clickable.
//
// Everything is a pure function of the piece, so a retried post republishes
// byte-identical copy.

import { artPhrase, pieceHashtags } from './hashtags.mjs'
import { SITE_ORIGIN, landingUrl } from './pieces.mjs'

/** What the app is, in as few words as a phone will show. */
const PITCH = 'Animated art screensaver app'

/** The first (on a phone, often the only visible) line of every IG / YouTube post. */
export const CAPTION = `${PITCH} - Link in bio`

/** TikTok's first line: its link lives in the pinned comment, and as plain text in the bio. */
const TIKTOK_CAPTION = `${PITCH} - Link in comment and bio`

/** Pinned under every TikTok video. Verified visible to signed-out viewers, 2026-09-14. */
const LINK_COMMENT = `Get the screensaver app: ${SITE_ORIGIN.replace(/^https?:\/\//, '')}`

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

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/** "a", "a and b", "a, b and c". */
const spoken = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

/** Distinct hashtags, first `max` of them, as one line. */
const hashtagLine = (tags, max) => [...new Set(tags)].slice(0, max).join(' ')

/**
 * The pieces' own hashtags, every piece's most specific one before any piece's
 * second, so a capped line shows the range of a set rather than only its first piece.
 */
function ownHashtags(pieces) {
  const lists = pieces.map(pieceHashtags)
  const ranked = []
  for (let rank = 0; lists.some((tags) => rank < tags.length); rank++) {
    for (const tags of lists) if (rank < tags.length) ranked.push(tags[rank])
  }
  return [...new Set(ranked)]
}

/**
 * `render(lines)` with as many piece lines as fit in `max` characters, counting the
 * rest ("+2 more"). Only a very long set ever reaches a limit.
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
 * characters in all, counting the quotes it puts around a tag with a space.
 */
function youtubeTags(pieces) {
  const tags = [...new Set(['screensaver app', 'animated art', ...pieces.flatMap((p) => [p.style, p.title])]
    .map((t) => t.replace(/[,<>]/g, '').trim()).filter(Boolean))]
  const size = (list) => list.reduce((n, t) => n + t.length + (t.includes(' ') ? 2 : 0), list.length - 1)
  while (size(tags) > LIMIT.youtubeTags) tags.pop()
  return tags
}

/**
 * Every string the four platforms need for one post: a list of pieces, in the
 * order the clip shows them, each `{ title, style, era, webSlug }`. `era` is the
 * piece's gallery tag ("Japanese", "Modern"…), or null for a clip rendered from
 * outside the gallery.
 */
export function buildCaptions(pieces) {
  const [first] = pieces
  const lines = pieces.map((p) => titleLine(p.title, p.style))
  const own = ownHashtags(pieces)
  const feedTags = hashtagLine(['#screensaver', '#animatedart', ...own], 4)
  const phrases = [...new Set(pieces.map(artPhrase).filter(Boolean))]
  const name = postName(pieces)
  return {
    instagram: { text: fit(LIMIT.instagram, lines, (l) => `${CAPTION}\n\n${l.join('\n')}\n${feedTags}`) },
    tiktok: {
      text: fit(LIMIT.tiktok, lines, (l) => `${TIKTOK_CAPTION}\n\n${l.join('\n')}\n${feedTags}`),
      linkComment: LINK_COMMENT,
    },
    youtube: {
      // The Shorts player shows the title, so the fixed line goes there, and a set
      // is named after it; the description (rarely seen, but searched) names each
      // piece. Its hashtags put the pieces' own first: YouTube shows up to three
      // beside the title.
      title: pieces.length === 1 ? CAPTION : clamp(`${CAPTION} · ${name}`, LIMIT.youtubeTitle),
      description: fit(LIMIT.youtubeDescription, lines,
        (l) => `${l.join('\n')}\n\n${hashtagLine([...own, '#animatedart'], 3)}`),
      tags: youtubeTags(pieces),
    },
    pinterest: {
      // Style first: it is what people search for, and search ranks the title. A
      // set leads with its first piece, whose page the pin links to.
      title: clamp(`Animated ${first.style}: ${name} | Art screensaver app`, LIMIT.pinTitle),
      description: fit(LIMIT.pinDescription, lines, (l) => `${l.join('. ')}. ${
        phrases.length ? `${capitalize(spoken(phrases))}, gently animated` : 'Gently animated art'
      } for your screensaver by Living Art Screensaver, with ${
        pieces.length === 1 ? 'a new piece' : 'new pieces'
      } every night.`),
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
