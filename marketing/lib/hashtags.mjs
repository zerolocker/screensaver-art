// Hashtags and search phrases for a piece, derived from its style and its
// gallery era tag. Used by lib/captions.mjs; nothing is stored per piece.
//
// Two rules keep every tag honest:
//   - It must be true of the piece. An era only gets a hashtag when it fits every
//     style filed under it. "Chinese & Korean" has none, because #chineseart is
//     wrong on a Joseon painting; those pieces get theirs from the style instead.
//   - It must have an audience, about the right thing. Most styles are used once
//     ("Modernist Sporting Oil"), so only well-known movements, schools and
//     countries map to a tag. Every tag here was checked against TikTok's own
//     counts (2026-09-14): under ~5M views was dropped, and where the bare word is
//     used for much else the art-specific form wins (#renaissanceart, not
//     #renaissance; #cyberpunkart, not the game-heavy #cyberpunk).
//
// Pure data and two pure functions, no deps.

/** Era tag → the hashtag and search phrase that are true of every piece under it. */
const ERA = {
  'Prehistoric': { tag: '#prehistoricart', phrase: 'prehistoric art' },
  'Egyptian': { tag: '#egyptianart', phrase: 'ancient Egyptian art' },
  'Ancient Near East': { tag: '#ancientart', phrase: 'ancient Near Eastern art' },
  'Greek & Roman': { tag: '#ancientart', phrase: 'ancient Mediterranean art' },
  'Arts of the Americas': { tag: '#mesoamerica', phrase: 'Mesoamerican art' },
  // Aboriginal, Māori, West African, Ethiopian…: no one tag or phrase fits them all.
  'Arts of Africa & Oceania': {},
  'Japanese': { tag: '#japaneseart', phrase: 'Japanese art' },
  'Chinese & Korean': { phrase: 'East Asian art' },
  'South & Southeast Asian': { phrase: 'South and Southeast Asian art' },
  'Islamic': { tag: '#islamicart', phrase: 'Islamic art' },
  'Medieval & Byzantine': { tag: '#medievalart', phrase: 'medieval art' },
  'Renaissance & Baroque': { tag: '#oldmasters', phrase: 'Old Master painting' },
  '19th Century': { tag: '#19thcenturyart', phrase: '19th-century art' },
  'Modern': { tag: '#modernart', phrase: 'modern art' },
  // Cyberpunk to storybook illustration: the style decides the tag.
  'Contemporary': { phrase: 'contemporary art' },
}

/**
 * Style → hashtag (and, where the era's phrase is too broad, a search phrase).
 * First match wins, so the more specific patterns come first.
 */
const STYLE = [
  // Japan
  [/ukiyo-?e/i, { tag: '#ukiyoe' }],
  [/shin-?hanga/i, { tag: '#woodblockprint' }],
  [/sumi-?e/i, { tag: '#sumie' }],
  // China and Korea
  [/joseon|goryeo/i, { tag: '#koreanart', phrase: 'Korean art' }],
  [/chinese|\bming\b|\bqing\b|song dynasty|tang dynasty|yuan dynasty|han dynasty|lingnan|suzhou/i,
    { tag: '#chineseart', phrase: 'Chinese art' }],
  // South and Southeast Asia
  [/mughal/i, { tag: '#mughalart', phrase: 'Mughal art' }],
  [/rajput|rajasthani|pahari|kangra|kishangarh|deccan|tanjore|kerala/i, { tag: '#indianart', phrase: 'Indian art' }],
  [/\bthai\b/i, { tag: '#thaiart', phrase: 'Thai art' }],
  [/vietnamese/i, { phrase: 'Vietnamese art' }],
  [/balinese/i, { tag: '#balineseart', phrase: 'Balinese art' }],
  // The Persian and Ottoman worlds
  [/persian|safavid|qajar|timurid/i, { tag: '#persianart', phrase: 'Persian art' }],
  [/ottoman|iznik/i, { phrase: 'Ottoman art' }],
  // Africa and Oceania
  [/aboriginal/i, { tag: '#aboriginalart', phrase: 'Aboriginal art' }],
  [/maori/i, { tag: '#maoriart', phrase: 'Māori art' }],
  [/west african|tingatinga|ethiopian/i, { tag: '#africanart', phrase: 'African art' }],
  // Movements and schools
  [/art deco/i, { tag: '#artdeco' }],
  [/art nouveau/i, { tag: '#artnouveau' }],
  [/harlem renaissance/i, { tag: '#harlemrenaissance' }],
  [/post-impressionis/i, { tag: '#postimpressionism' }],
  [/impressionis/i, { tag: '#impressionism' }],
  [/pointillis|divisionis/i, { tag: '#pointillism' }],
  [/fauvis/i, { tag: '#fauvism' }],
  [/expressionis/i, { tag: '#expressionism' }],
  [/surrealis/i, { tag: '#surrealism' }],
  [/cubis/i, { tag: '#cubism' }],
  [/retro-?futuris/i, { tag: '#retrofuturism' }],
  [/rococo/i, { tag: '#rococoart' }],
  [/romantic/i, { tag: '#romanticism' }],
  [/dutch golden age/i, { tag: '#dutchgoldenage' }],
  [/baroque|caravagg|tenebris|chiaroscuro/i, { tag: '#baroqueart' }],
  [/renaissance|flemish primitives|mannerism/i, { tag: '#renaissanceart' }],
  [/cave painting/i, { tag: '#cavepaintings' }],
  [/neoclassic/i, { tag: '#neoclassicism' }],
  [/symbolism/i, { tag: '#symbolismart' }],
  [/stained glass/i, { tag: '#stainedglass' }],
  [/byzantine/i, { tag: '#byzantineart' }],
  [/mosaic/i, { tag: '#mosaicart' }],
  [/illuminated manuscript|book of hours/i, { tag: '#illuminatedmanuscript' }],
  [/muralism/i, { tag: '#muralism' }],
  [/steampunk/i, { tag: '#steampunkart' }],
  [/dieselpunk/i, { tag: '#dieselpunk' }],
  [/solarpunk/i, { tag: '#solarpunk' }],
  [/cyberpunk|cyber-gothic|neo-tokyo/i, { tag: '#cyberpunkart' }],
  [/pixel art/i, { tag: '#pixelart' }],
  [/vaporwave/i, { tag: '#vaporwave' }],
  [/dark academia/i, { tag: '#darkacademia' }],
  [/watercolou?r/i, { tag: '#watercolor' }],
  [/hudson river school|landscape/i, { tag: '#landscapepainting' }],
  [/illustration/i, { tag: '#illustration' }],
]

const styleRule = (style) => STYLE.find(([re]) => re.test(style ?? ''))?.[1] ?? {}

/** The piece's own hashtags, most specific first: its style's, then its era's. */
export function pieceHashtags({ style, era }) {
  return [...new Set([styleRule(style).tag, ERA[era]?.tag].filter(Boolean))]
}

/** How to name the piece's art in a sentence ("Japanese art"), or null if nothing fits. */
export function artPhrase({ style, era }) {
  return styleRule(style).phrase ?? ERA[era]?.phrase ?? null
}
