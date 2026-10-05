/**
 * Hand-written copy for each era (`TAG_ORDER`), used on `/era/<tag>` and as
 * the middle paragraph of every piece page. A blurb describes the historical
 * tradition only. It must not say the pieces are AI-made or originals, since a
 * wing holds both kinds. A test checks every tag has an entry.
 */

export interface EraCopy {
  /** Page headline for `/era/<tag>` — a phrase, not the bare tag. */
  headline: string
  /** One paragraph, also used on every piece page in the era. */
  blurb: string
  /** Short line under the headline / on the era card. */
  tagline: string
}

export const ERA_COPY: Record<string, EraCopy> = {
  Prehistoric: {
    headline: 'The oldest pictures we have',
    tagline: 'Ochre, charcoal and firelight',
    blurb:
      'Before writing, before cities, people ground ochre and charcoal and put animals on cave walls. What survives is astonishingly confident: a few lines and a herd is moving. These pieces reach for that — flat earth pigments, rock texture, and figures that read instantly at a distance.',
  },
  Egyptian: {
    headline: 'Three thousand years of one style',
    tagline: 'Tomb walls, papyrus and the Nile',
    blurb:
      'Egyptian art held its conventions for longer than any tradition since: figures in profile, registers stacked like sentences, colour laid flat and bright on plaster. It was made to last forever in the dark, which is a strange and fitting thing to hang on a screen that only wakes when you leave the room.',
  },
  'Ancient Near East': {
    headline: 'Palaces, tribute and carved stone',
    tagline: 'Mesopotamia, Assyria and Persia',
    blurb:
      'From Sumer to Persepolis, the art of the ancient Near East was largely architectural — glazed brick processions, carved reliefs of lion hunts and tribute-bearers, everything in rhythmic, repeating rows. The scenes are ceremonial and unhurried, which makes them unusually good company on an idle display.',
  },
  'Greek & Roman': {
    headline: 'The classical world, still warm',
    tagline: 'Fresco, mosaic and painted pottery',
    blurb:
      'Almost no Greek painting survives; what we know comes from vases, Roman copies, and the walls that Vesuvius happened to bury. So the classical look we recognise — red-figure silhouettes, garden frescoes, tessellated floors — is reconstructed from fragments. These pieces work in that same vocabulary of mosaic tesserae and cracked painted plaster.',
  },
  'Arts of the Americas': {
    headline: 'Before and beyond the conquest',
    tagline: 'Andean, Maya, Mexica and beyond',
    blurb:
      'Textiles, codices, painted ceramics, feather-work, monumental stone — the traditions of the Americas ran on their own logic entirely, with dense symbolic patterning and colour that has kept its intensity for a thousand years. The pieces here follow that patterning rather than European perspective.',
  },
  'Arts of Africa & Oceania': {
    headline: 'Pattern, mask and ancestor',
    tagline: 'Sculptural traditions of Africa and the Pacific',
    blurb:
      'Sculpture, bark cloth, body ornament and mask-making across Africa and the Pacific produced some of the boldest abstraction anywhere — form pared to its essentials, surfaces alive with pattern. European modernism spent the twentieth century catching up with it. These pieces take their cues from that geometry.',
  },
  Japanese: {
    headline: 'Ukiyo-e, ink and gold leaf',
    tagline: 'Edo woodblock to modern Nihonga',
    blurb:
      "Japanese painting keeps finding the same balance from very different directions: flat colour against empty space, a horizon placed high, weather doing most of the emotional work. Woodblock prints, sumi-e ink, gold-ground screens and Nihonga pigment all show up in this wing — and all of them suit a screen that's meant to be glanced at, not stared down.",
  },
  'Chinese & Korean': {
    headline: 'Mountains, mist and brush',
    tagline: 'Song landscape to Joseon folk painting',
    blurb:
      'A thousand years of ink landscape treat empty paper as a real material — the mist between two peaks is the point, not the gap. Alongside it run court silk painting, Joseon minhwa with its tigers and magpies, and porcelain-blue palettes. Slow, deep, and built for looking at over a long time.',
  },
  'South & Southeast Asian': {
    headline: 'Miniatures, temples and monsoon light',
    tagline: 'Mughal, Rajput, Khmer and Javanese',
    blurb:
      'Mughal and Rajput miniatures pack whole courts into a page, with jewel colour and a border that refuses to stay out of the picture. Around them sit temple relief, Thangka painting and the stone and shadow-puppet traditions of Southeast Asia. Intricate work that rewards a second look on the way past.',
  },
  Islamic: {
    headline: 'Geometry, calligraphy and the garden',
    tagline: 'From al-Andalus to Isfahan',
    blurb:
      'Islamic art turned pattern into a discipline — tiling that resolves in every direction, calligraphy as ornament and argument at once, gardens as a picture of paradise. Its manuscript painting is equally rich, all flattened space and saturated mineral colour. Movement suits it: the geometry is already rhythmic.',
  },
  'Medieval & Byzantine': {
    headline: 'Gold ground and coloured glass',
    tagline: 'Icons, mosaics and illuminated pages',
    blurb:
      'A thousand years that were happy to skip realism entirely: figures float on gold, scale follows importance rather than distance, and light comes through the picture instead of falling on it. Stained glass, mosaic and manuscript illumination were all designed to glow in a dark room — which is exactly what a screensaver does.',
  },
  'Renaissance & Baroque': {
    headline: 'Light learns to fall',
    tagline: 'Florence and Venice to the Dutch Golden Age',
    blurb:
      'Perspective, anatomy, and then — with Caravaggio and the painters who followed him — the discovery that a single light source in a dark room does more dramatic work than any amount of drawing. This wing runs from Renaissance clarity through Baroque theatre to the quiet Dutch interiors at the far end of it.',
  },
  '19th Century': {
    headline: 'Paint stops hiding',
    tagline: 'Romanticism, Impressionism and Art Nouveau',
    blurb:
      'The century when the brushstroke became visible on purpose. Romantic storms and sublime landscapes give way to painters working outdoors, chasing weather and light in a single sitting, and finally to the decorative line of Art Nouveau. The largest wing here, and the one where motion feels most native — this art was already about things changing.',
  },
  Modern: {
    headline: 'Taking the picture apart',
    tagline: 'Cubism, Bauhaus, Surrealism and after',
    blurb:
      'In roughly fifty years painting dismantled perspective, colour, subject and eventually the frame. Cubism fractures the view, Fauvism throws out local colour, Bauhaus reduces to grid and primary, Surrealism reassembles it all wrong on purpose. Bold, graphic work that holds up at any size on any screen.',
  },
  Contemporary: {
    headline: 'Now, and slightly ahead of it',
    tagline: 'Digital, neon and speculative worlds',
    blurb:
      'The newest wing, and the one with no historical brief to answer to: cyberpunk skylines, solarpunk greenery, vaporwave sunsets, pixel-art villages and cosmic scenes. These lean hardest into being animated, because unlike the rest of the collection they were never trying to look like a painting on a wall.',
  },
}
