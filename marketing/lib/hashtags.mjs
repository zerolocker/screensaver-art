// Hashtags and search phrases for a piece, from its style and era tag, or for a
// real artwork from its artist. Every tag must be true of every piece it lands on
// ("Chinese & Korean" has none: #chineseart is wrong on a Korean painting) and
// have a real audience. The style and era tags were checked against TikTok's view
// counts (under ~5M dropped; #renaissanceart over the ambiguous #renaissance).

/** Era tag → a hashtag and phrase true of every piece under it. */
const ERA = {
  'Prehistoric': { tag: '#prehistoricart', phrase: 'prehistoric art' },
  'Egyptian': { tag: '#egyptianart', phrase: 'ancient Egyptian art' },
  'Ancient Near East': { tag: '#ancientart', phrase: 'ancient Near Eastern art' },
  'Greek & Roman': { tag: '#ancientart', phrase: 'ancient Mediterranean art' },
  'Arts of the Americas': { tag: '#mesoamerica', phrase: 'Mesoamerican art' },
  // Too varied for one tag or phrase.
  'Arts of Africa & Oceania': {},
  'Japanese': { tag: '#japaneseart', phrase: 'Japanese art' },
  'Chinese & Korean': { phrase: 'East Asian art' },
  'South & Southeast Asian': { phrase: 'South and Southeast Asian art' },
  'Islamic': { tag: '#islamicart', phrase: 'Islamic art' },
  'Medieval & Byzantine': { tag: '#medievalart', phrase: 'medieval art' },
  'Renaissance & Baroque': { tag: '#oldmasters', phrase: 'Old Master painting' },
  '19th Century': { tag: '#19thcenturyart', phrase: '19th-century art' },
  'Modern': { tag: '#modernart', phrase: 'modern art' },
  // Too varied: the style decides.
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

// ── Real public-domain artworks ─────────────────────────────────────────────
//
// A real painting's hashtags come from its artist. A movement is claimed only
// for artists squarely in one (Manet, Sargent and Whistler get their era's tag),
// and #famouspaintings only for listed names. Tags are the forms people use
// (#claudemonet, #jmwturner) but were NOT checked against TikTok's counts.
// Unlisted artists get a full-name tag. Patterns use full names where a surname
// is shared (Rex Whistler, Yasuo Kuniyoshi, Rembrandt Peale).

/** Artist (matched against the provenance `artist`) → short name, hashtag, movement. */
const ARTISTS = [
  // Impressionism
  [/caillebotte/i, { name: 'Caillebotte', tag: '#caillebotte', movement: 'Impressionism' }],
  [/claude monet/i, { name: 'Monet', tag: '#claudemonet', movement: 'Impressionism' }],
  [/renoir/i, { name: 'Renoir', tag: '#renoir', movement: 'Impressionism' }],
  [/pissarro/i, { name: 'Pissarro', tag: '#pissarro', movement: 'Impressionism' }],
  [/sisley/i, { name: 'Sisley', tag: '#alfredsisley', movement: 'Impressionism' }],
  [/morisot/i, { name: 'Morisot', tag: '#berthemorisot', movement: 'Impressionism' }],
  [/cassatt/i, { name: 'Cassatt', tag: '#marycassatt', movement: 'Impressionism' }],
  [/degas/i, { name: 'Degas', tag: '#degas', movement: 'Impressionism' }],
  [/\bmanet\b/i, { name: 'Manet', tag: '#manet' }],
  // Post-Impressionism and Pointillism
  [/van gogh/i, { name: 'Van Gogh', tag: '#vangogh', movement: 'Post-Impressionism' }],
  [/gauguin/i, { name: 'Gauguin', tag: '#gauguin', movement: 'Post-Impressionism' }],
  [/c[ée]zanne/i, { name: 'Cézanne', tag: '#cezanne', movement: 'Post-Impressionism' }],
  [/toulouse-?lautrec/i, { name: 'Toulouse-Lautrec', tag: '#toulouselautrec', movement: 'Post-Impressionism' }],
  [/seurat/i, { name: 'Seurat', tag: '#seurat', movement: 'Pointillism' }],
  [/signac/i, { name: 'Signac', tag: '#paulsignac', movement: 'Pointillism' }],
  // Romanticism and the landscape schools
  [/joseph mallord william turner|j\.\s*m\.\s*w\.\s*turner/i, { name: 'Turner', tag: '#jmwturner', movement: 'Romanticism' }],
  [/john constable/i, { name: 'Constable', tag: '#johnconstable', movement: 'Romanticism' }],
  [/caspar david friedrich/i, { name: 'Friedrich', tag: '#caspardavidfriedrich', movement: 'Romanticism' }],
  [/\bgoya\b/i, { name: 'Goya', tag: '#goya', movement: 'Romanticism' }],
  [/bierstadt/i, { name: 'Bierstadt', tag: '#albertbierstadt', movement: 'Hudson River School' }],
  [/thomas cole/i, { name: 'Thomas Cole', tag: '#thomascole', movement: 'Hudson River School' }],
  [/frederic edwin church/i, { name: 'Church', tag: '#fredericedwinchurch', movement: 'Hudson River School' }],
  [/john singer sargent/i, { name: 'Sargent', tag: '#johnsingersargent' }],
  [/james (abbott )?mcneill whistler/i, { name: 'Whistler', tag: '#whistler' }],
  [/winslow homer/i, { name: 'Winslow Homer', tag: '#winslowhomer' }],
  [/sorolla/i, { name: 'Sorolla', tag: '#sorolla' }],
  // Art Nouveau, Symbolism, Expressionism
  [/mucha/i, { name: 'Mucha', tag: '#alphonsemucha', movement: 'Art Nouveau' }],
  [/klimt/i, { name: 'Klimt', tag: '#klimt', movement: 'Art Nouveau' }],
  [/edvard munch/i, { name: 'Munch', tag: '#edvardmunch', movement: 'Expressionism' }],
  // Japan
  [/hokusai/i, { name: 'Hokusai', tag: '#hokusai', movement: 'Ukiyo-e' }],
  [/hiroshige/i, { name: 'Hiroshige', tag: '#hiroshige', movement: 'Ukiyo-e' }],
  [/utamaro/i, { name: 'Utamaro', tag: '#utamaro', movement: 'Ukiyo-e' }],
  [/utagawa kuniyoshi/i, { name: 'Kuniyoshi', tag: '#kuniyoshi', movement: 'Ukiyo-e' }],
  // Old Masters
  [/vermeer/i, { name: 'Vermeer', tag: '#vermeer', movement: 'Dutch Golden Age' }],
  [/rembrandt (harmensz\.? )?van rijn|^rembrandt$/i, { name: 'Rembrandt', tag: '#rembrandt', movement: 'Dutch Golden Age' }],
  [/caravaggio/i, { name: 'Caravaggio', tag: '#caravaggio', movement: 'Baroque' }],
  [/rubens/i, { name: 'Rubens', tag: '#rubens', movement: 'Baroque' }],
  [/vel[áa]zquez/i, { name: 'Velázquez', tag: '#velazquez', movement: 'Baroque' }],
  [/fragonard/i, { name: 'Fragonard', tag: '#fragonard', movement: 'Rococo' }],
  [/watteau/i, { name: 'Watteau', tag: '#watteau', movement: 'Rococo' }],
  [/pieter bruegh?el/i, { name: 'Bruegel', tag: '#bruegel', movement: 'Renaissance' }],
  [/bosch/i, { name: 'Bosch', tag: '#hieronymusbosch', movement: 'Renaissance' }],
  [/botticelli/i, { name: 'Botticelli', tag: '#botticelli', movement: 'Renaissance' }],
  [/d[üu]rer/i, { name: 'Dürer', tag: '#albrechtdurer', movement: 'Renaissance' }],
  [/titian|tiziano/i, { name: 'Titian', tag: '#titian', movement: 'Renaissance' }],
]

/** "Unknown artist", "Anonymous", "Unidentified Artist"… — nobody to credit by name. */
const isAnonymous = (artist) => !artist || /^(unknown|anonymous|unidentified)\b/i.test(artist.trim())

const artistRule = (artist) => ARTISTS.find(([re]) => re.test(artist ?? ''))?.[1] ?? null

/** "Gustave Caillebotte" → "#gustavecaillebotte": accents dropped, letters and digits only. */
const nameTag = (artist) => {
  const t = artist.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return t.length >= 3 && t.length <= 24 ? `#${t}` : null
}

/**
 * The name a caption calls the artist by ("Caillebotte", "Van Gogh"), or null
 * for an anonymous work. Unlisted artists go by their full name.
 */
export function artistShortName(artist) {
  if (isAnonymous(artist)) return null
  return artistRule(artist)?.name ?? artist.trim()
}

/** The artist's movement as a style label ("Impressionism"), or null if we don't claim one. */
export function artistMovement(artist) {
  return isAnonymous(artist) ? null : artistRule(artist)?.movement ?? null
}

/**
 * A real artwork's own hashtags, most specific first: the artist, their movement
 * (or, if we don't claim one, their era's tag), #arthistory, then
 * #famouspaintings for the famous names above. Callers cap the list per platform.
 */
export function artworkHashtags({ artist, era }) {
  const known = isAnonymous(artist) ? null : artistRule(artist)
  const movementTag = known?.movement ? styleRule(known.movement).tag : null
  return [...new Set([
    isAnonymous(artist) ? null : known?.tag ?? nameTag(artist),
    movementTag ?? ERA[era]?.tag,
    '#arthistory',
    known ? '#famouspaintings' : null,
  ].filter(Boolean))]
}

/** The piece's own hashtags, most specific first: its style's, then its era's. */
export function pieceHashtags({ style, era }) {
  return [...new Set([styleRule(style).tag, ERA[era]?.tag].filter(Boolean))]
}

/** How to name the piece's art in a sentence ("Japanese art"), or null if nothing fits. */
export function artPhrase({ style, era }) {
  return styleRule(style).phrase ?? ERA[era]?.phrase ?? null
}
