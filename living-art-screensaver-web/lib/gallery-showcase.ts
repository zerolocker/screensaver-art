// Showcase data for the marketing homepage. Pure data + helpers (no React),
// so it can be imported by any client component.
// Video assets live on the public R2 bucket, served through the Cloudflare
// custom domain (screensaver-assets.living-art-asset.com) — NOT the r2.dev
// dev endpoint, which bypasses Cloudflare's CDN cache and is rate-limited /
// not-for-production. The custom domain routes through Cloudflare's edge, so
// these multi-MB clips are edge-cached (cf-cache-status HIT) and browsers get
// Cloudflare's default ~4h Browser Cache TTL out of the box — avoiding re-fetch
// on repeat visits and reel wrap-arounds.
// Each piece carries the same { name, style } placard shown in-app.

export const R2_GALLERY = "https://screensaver-assets.living-art-asset.com/gallery/"

export interface Piece {
  src: string
  name: string
  style: string
}

const v = (file: string, name: string, style: string): Piece => ({
  src: R2_GALLERY + file,
  name,
  style,
})

// Deterministic poster background per piece — a colored gradient derived from the
// title, shown behind a video until it paints (and as the ambient glow source).
export function hashHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h % 360
}

export function poster(it?: { name?: string }): string {
  const H = hashHue((it && it.name) || "living art")
  const H2 = (H + 36) % 360
  return `radial-gradient(125% 95% at 30% 14%, hsl(${H} 44% 40%), hsl(${H2} 50% 22%) 74%)`
}

// The real-art poster image for a piece — the exact first frame of its clip,
// pre-extracted to a ~50 KB WebP in public/posters/ (see
// scripts/generate-posters.mjs). Painted under/before the video so visitors on
// slow links see the artwork immediately instead of the gradient.
export function posterImage(it?: { src?: string }): string {
  const file = it?.src?.split("/").pop() ?? ""
  return "/posters/" + file.replace(/\.mp4$/, ".webp")
}

// The placard label, e.g. "Starry Coast · Post-Impressionism".
export function pieceLabel(it?: Piece): string {
  if (!it) return ""
  return it.style ? `${it.name} · ${it.style}` : it.name
}

// Rotating reel behind the hero + final-CTA monitors.
export const heroReel: Piece[] = [
  v("starry_coast_animated.mp4", "Starry Coast", "Post-Impressionism"),
  v("romanticism_storm_animated.mp4", "Stormy Sea", "Romanticism"),
  v("floating_city_animated.mp4", "Floating City", "Steampunk"),
  v("cubism_city_animated.mp4", "Geometric Sunset", "Cubism"),
  v("dutch_golden_age_scholar_animated.mp4", "Study in Light", "Dutch Golden Age"),
  v("art_nouveau_woman_animated.mp4", "Woman and Flora", "Art Nouveau"),
  v("gothic_glass_animated.mp4", "Cathedral Light", "Gothic Stained Glass"),
]

// "The collection" marquee tiles.
export const carousel: Piece[] = [
  v("starry_coast_animated.mp4", "Starry Coast", "Post-Impressionism"),
  v("cyberpunk_neon_city_animated.mp4", "Neon City", "Cyberpunk"),
  v("gothic_glass_animated.mp4", "Cathedral Light", "Gothic Stained Glass"),
  v("neoclassicism_roman_forum_animated.mp4", "Roman Forum", "Neoclassicism"),
  v("edo_sumie_animated.mp4", "Misty Mountains", "Sumi-e"),
  v("nebula_dreams_animated.mp4", "Nebula Dreams", "Cosmic"),
  v("rococo_garden_party_v2_animated.mp4", "Garden Party", "Rococo"),
  v("romanticism_sea_animated.mp4", "Stormy Cliffs", "Romanticism"),
]

export interface Movement {
  name: string
  era: string
  pieces: Piece[]
}

// The interactive "Wander the whole history of art" browser.
export const movements: Movement[] = [
  {
    name: "Antiquity",
    era: "Prehistory – 5th c.",
    pieces: [
      v("hellenistic_mosaic_animated.mp4", "Ocean God", "Hellenistic Mosaic"),
      v("ancient_egyptian_procession_animated.mp4", "River Procession", "Ancient Egyptian"),
      v("mycenaean_fresco_animated.mp4", "Warriors on Chariots", "Mycenaean Fresco"),
      v("cave_animated.mp4", "Ancient Hunt", "Paleolithic Cave"),
      v("coptic_textile_1_animated.mp4", "Woven Figures", "Coptic Textile"),
    ],
  },
  {
    name: "Medieval & Gothic",
    era: "5th – 15th c.",
    pieces: [
      v("gothic_glass_animated.mp4", "Cathedral Light", "Gothic Stained Glass"),
      v("fresco_animated_v2.mp4", "Saints", "Romanesque Fresco"),
      v("gothic_manuscript_animated.mp4", "Gothic Marketplace", "Illuminated Manuscript"),
      v("byzantine_mosaic_animated.mp4", "Golden Mosaic", "Byzantine"),
      v("gothic_cathedral_animated.mp4", "Dark Cathedral", "Gothic Revival"),
    ],
  },
  {
    name: "Renaissance & Baroque",
    era: "14th – 18th c.",
    pieces: [
      v("dutch_golden_age_scholar_animated.mp4", "Study in Light", "Dutch Golden Age"),
      v("chiaroscuro_reader_animated.mp4", "Solitary Reader", "Chiaroscuro"),
      v("utrecht_lute_animated.mp4", "Lute Players", "Utrecht Caravaggism"),
      v("baroque_galleon.mp4", "Sunset Galleon", "Baroque"),
      v("mannerism_figure_animated.mp4", "Twisted Figure", "Mannerism"),
      v("rococo_garden_party_v2_animated.mp4", "Garden Party", "Rococo"),
    ],
  },
  {
    name: "Romanticism",
    era: "18th – 19th c.",
    pieces: [
      v("romanticism_storm_animated.mp4", "Stormy Sea", "Romanticism"),
      v("romanticism_castle.mp4", "Ruined Castle", "Romanticism"),
      v("hudson_river_school_valley_animated.mp4", "Majestic Valley", "Hudson River School"),
      v("barbizon_forest_animated.mp4", "Twilight Forest", "Barbizon School"),
      v("neoclassicism_roman_forum_animated.mp4", "Roman Forum", "Neoclassicism"),
    ],
  },
  {
    name: "Impressionism & Art Nouveau",
    era: "1860s – 1910s",
    pieces: [
      v("starry_coast_animated.mp4", "Starry Coast", "Post-Impressionism"),
      v("impressionist_pond_animated.mp4", "Impressionist Pond", "Impressionism"),
      v("art_nouveau_woman_animated.mp4", "Woman and Flora", "Art Nouveau"),
      v("arts_and_crafts_garden_animated.mp4", "Decorative Garden", "Arts & Crafts"),
      v("symbolism_island_animated.mp4", "Mystical Island", "Symbolism"),
    ],
  },
  {
    name: "East Asian",
    era: "Across the dynasties",
    pieces: [
      v("ukiyoe_great_wave_mountain_animated.mp4", "Great Wave", "Ukiyo-e"),
      v("ukiyoe_mtfuji.mp4", "Snowy Fuji", "Ukiyo-e"),
      v("edo_sumie_animated.mp4", "Misty Mountains", "Sumi-e Ink Wash"),
      v("edo_byobu_animated.mp4", "Cranes in River", "Edo Byobu"),
      v("ming_silk_animated.mp4", "Mountain Landscape", "Ming Dynasty Silk"),
      v("kano_school_ink_painting_animated.mp4", "Serene Landscape", "Kano School"),
      v("joseon_animated.mp4", "Tiger and Magpie", "Joseon Minhwa"),
    ],
  },
  {
    name: "Modern",
    era: "20th century",
    pieces: [
      v("cubism_city_animated.mp4", "Geometric Sunset", "Cubism"),
      v("fauvism_landscape_animated.mp4", "Fauvism Flow", "Fauvism"),
      v("art_deco_ballroom_animated.mp4", "Grand Ballroom", "Art Deco"),
      v("bauhaus_architecture_animated.mp4", "Bauhaus", "Bauhaus"),
      v("abstract_expressionism_chaos_animated.mp4", "Chaos", "Abstract Expressionism"),
      v("constructivism_industrial_animated.mp4", "Industrial Rhythm", "Constructivism"),
      v("surreal_clocks_animated.mp4", "Melting Clocks", "Surrealism"),
    ],
  },
  {
    name: "Contemporary & Digital",
    era: "Today",
    pieces: [
      v("cyberpunk_neon_city_animated.mp4", "Neon City", "Cyberpunk"),
      v("floating_city_animated.mp4", "Floating City", "Steampunk"),
      v("solarpunk_noir_city_animated.mp4", "Neon Rain", "Solarpunk Noir"),
      v("vaporwave_sunset_animated.mp4", "Vaporwave Sunset", "Vaporwave"),
      v("pixel_village_animated.mp4", "Cozy Village", "Pixel Art"),
      v("isometric_island_animated.mp4", "Floating Island", "Isometric"),
      v("nebula_dreams_animated.mp4", "Nebula Dreams", "Cosmic"),
      v("biolum_rainforest_animated.mp4", "Bioluminescent Rainforest", "Biopunk"),
    ],
  },
]
