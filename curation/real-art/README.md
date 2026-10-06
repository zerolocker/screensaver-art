# curation/real-art

Scripts for the first half of the real-paintings curation ([`REAL_PAINTINGS_CURATION.md`](../REAL_PAINTINGS_CURATION.md)): find paintings, clear them legally, and frame them. The curator picks the four, then animates them with Omni and publishes with `publish-piece.mjs --provenance`.

Needs Node 18+ and `ffmpeg`/`ffprobe`. No npm packages, no API keys.

## find-paintings.mjs

```bash
node curation/real-art/find-paintings.mjs --famous --out /tmp/cands.json      # most famous eligible works
node curation/real-art/find-paintings.mjs --query "harbor boats" --limit 30    # a theme
node curation/real-art/find-paintings.mjs --ids aic:27992,met:435702,rijks:SK-A-2344,smk:KMS3716,wd:Q45585 --show-rejects
```

| Flag | |
|---|---|
| `--sources aic,cma,met,nga,rijks,getty,smk,commons` | Sources to search (default: all eight) |
| `--query <theme>` | Keywords searched in every source |
| `--famous` | Rank by fame. The default when there's no `--query` or `--ids`. |
| `--ids src:id,…` | Check specific works: `aic:<id>`, `met:<objectID>`, `cma:<id or accession no.>`, `nga:<objectid or accession no.>`, `rijks:<object no. or Linked Art ID>`, `getty:<page slug, UUID or accession no.>`, `smk:<object no.>`, `wd:<Wikidata QID>` (Commons) |
| `--limit N` | Max eligible records written (default 40) |
| `--pool N` | Raw candidates fetched per source (default max(40, 2×limit)); Commons fetches 3× as many |
| `--out <file>` | Output file (default stdout). Progress goes to stderr. |
| `--show-rejects` | Also output rejected records with their reasons |

Sources (`museums.mjs` lists the seven museums):
- **The Art Institute of Chicago**, **the Cleveland Museum of Art** (`cc0=1`) and **the Met** (search on `/public/collection/v1.1/search`, objects on `/v1/objects/:id`): `sources.mjs`. The Met blocks an IP after about 80 requests a minute, so it's paced at one request a second; if it blocks us anyway, the run skips the Met and continues.
- **The National Gallery of Art, Washington** (`nga.mjs`) has no search API. The run reads its open-data CSV export ([NationalGalleryOfArt/opendata](https://github.com/NationalGalleryOfArt/opendata), ~230 MB) from a cache in the OS temp dir: a copy checked in the last 24 h is reused, an older one is revalidated with its ETag, and a stale copy serves if GitHub is down. `--query` searches titles, attributions, media and the export's keyword, theme, style and school terms.
- **The Rijksmuseum** (`rijks.mjs`): Linked Art records from `id.rijksmuseum.nl` and the search API at `data.rijksmuseum.nl/search/collection`. A work takes several requests (the object, its image's VisualItem and DigitalObject, each maker's Person record, the IIIF `info.json`). Its highlight flag is the museum's "Top 100" set.
- **The J. Paul Getty Museum** (`getty.mjs`): its SPARQL endpoint at `data.getty.edu`, then each open work's IIIF manifest for the image's rights and size.
- **SMK, the National Gallery of Denmark** (`smk.mjs`): `api.smk.dk`, in English (`lang=en`).
- **Wikimedia Commons** (`commons.mjs`).

The Commons lane finds paintings on Wikidata and takes each one's image (P18) from Commons:
- **Famous runs** take the most-linked paintings (P31 painting, portrait painting, watercolour painting, tableau, triptych or altarpiece) and keep those with 10+ Wikipedia editions.
- **`--query`** uses Wikidata's search and keeps works with 3+ editions (10+ with `--famous`).
- Creators and their dates come from P170, P569 and P570; attributions from P1773, P1774, P1779, P1780 and P1877. The date is P571, widened by its precision or a "latest date". The holder is the current P195: a department names its museum.
- It sends a User-Agent with a contact address, runs one Wikidata query at a time, and sends `maxlag` to Commons.

Each output record has:
- **Nine provenance keys** that `publish-piece.mjs` copies into `gallery.json`: `source` (`"real_artwork"`), `artist`, `artist_dates`, `original_title`, `original_date`, `museum`, `credit_line`, `source_url`, `license` (`"Public Domain"` or `"CC0"`). For Commons, `museum` is the holding institution, `credit_line` reads "Image: Wikimedia Commons, <file>", `source_url` is the Commons file page, and `license` is `"Public Domain"`.
- **Working keys:** `object_id` (`<source>:<id>`, `wd:Q…` for Commons), `image_url`, `width`, `height`, `aspect`, `classification`, `medium`, `fame`, `clearance`.

### The legal gate

`clearance.mjs` (tested by `clearance.test.mjs` and `museums.test.mjs`) rejects anything in doubt. A work passes only if:

1. **Licence:** the museum's own flag is Public Domain or CC0:
   - AIC `is_public_domain`, Met `isPublicDomain`, CMA `share_license_status == "CC0"`.
   - NGA: the primary published image has `openaccess = 1` (CC0).
   - Rijksmuseum: the image's own rights (its VisualItem) are the Public Domain Mark 1.0 or CC0 1.0.
   - Getty: the object's rights and its IIIF manifest's `rights` are both CC0 1.0.
   - SMK: `public_domain` is true and `rights` is the Public Domain Mark 1.0 or CC0 1.0.
   - For Commons, the file's `imageinfo` metadata: `License` `pd` or `cc0` (or a PD-Art / PD-old category), not marked `Copyrighted`, and no CC BY, CC BY-SA, GFDL or similar category.
2. **Life + 70:** every listed artist died in or before the current year − 71.
   - A "circa" death year counts as 10 years later.
   - An unknown death year passes only if the artist must have been dead by the cutoff, assuming a 110-year lifespan from their birth, active years or the work's date. So an unknown death on a post-1900 work always fails.
   - A structured birth or death year after the current year or before 3000 BC is a placeholder and counts as unknown. AIC gives undated agents `4713` for both.
   - Anonymous works, "attributed to / workshop of / after / circle of" works, and works with undated printers need a work date before 1900. The qualifier counts wherever the museum puts it: the label, the AIC agent title, the Met's prefix or name, CMA's qualifier or description, NGA's name prefix or attribution, the Rijksmuseum's attribution assignment, the Getty's name prefix, or SMK's role.
   - NGA life dates come from each artist's display date ("Italian, 1452 - 1519"), the Rijksmuseum's from its Person records, the Getty's from its producer description, and SMK's from `creator_date_of_birth` and `creator_date_of_death`. Former and rejected attributions name no author.
3. **Flat art:** paintings, prints (including ukiyo-e), drawings and watercolours. Not sculpture, textiles, decorative arts or photographs. NGA: classification Painting, Print, Drawing or Index of American Design. Rijksmuseum: its type of work. Getty: its AAT classification, and not a miniature still in its manuscript. SMK: its object names. Commons: a painting P31, or a triptych or altarpiece made with paint (P186), and never a sculpture or relief.
4. **Size:** the long edge is at least 2000 px. The Met's sizes are read from the JPEG header; Commons' from `imageinfo`.

Commons, the Rijksmuseum and SMK:

5. **US safety:** the work's latest date is at or before the current year − 96 (1930 in 2026). An unknown date fails. A "circa" date counts as 10 years later. Commons needs it because its legal basis is an argument (*Bridgeman v. Corel*, DSM Article 14) rather than the museum's own waiver; the Rijksmuseum and SMK because their public-domain mark only says life + 70 has run, and a work published after 1930 can still be in US copyright.

Commons only:

6. **Holder:** at least one current holder, and none that is an Italian public collection: an Italian holder typed as a national, Ministry of Culture or public-entity museum, owned or run by Italy, a ministry, a region, a province or a comune, or a state or civic museum by name.
7. **Open museums first:** when one of the seven museums holds the work (by P195, or its object ID or inventory number on Wikidata), the museum's own record is fetched. If it releases a usable image (its open flag, an image, 2000+ px), the Commons record is skipped for it. If it doesn't, the record passes with a reason such as "museum: The Metropolitan Museum of Art doesn't release a usable image (isPublicDomain = false); using Commons". If the record can't be found or fetched, the Commons record fails.

### Duplicates and fame

- Works already in `gallery.json` (matched by `source_url`) are skipped. A Commons work is also matched by artist and title against every real artwork, since its file can change; a museum work against the Commons-sourced ones, since a museum may start releasing a work we took from Commons.
- A work held by several museums keeps only its most famous copy. Two records are the same work when they have the same Wikidata QID; when one has none, when they have the same artist surname and title. A museum record's QID comes from the museum (NGA, the Met, CMA) or from the fame lookup.
- **Museum images win.** A Commons work whose holding open museum releases a usable image is skipped (check 7). A passing museum copy also beats a Commons copy of the same work, however famous. A Commons copy of a work the museum withholds keeps the museum as `museum` and the Commons file page as `source_url`.
- Fame is the number of Wikipedia language editions about the work, plus 5 for a museum highlight flag. It comes from Wikidata (`wikidata.mjs`) through each museum's object-ID property (AIC P4610, Met P3634, CMA P11110, NGA P4683, Rijksmuseum P13234, Getty P2582), plus its inventory number P217 qualified by the collection (AIC, CMA, the Rijksmuseum, the Getty, and SMK, which has no ID property), or for Commons the item's own count. If Wikidata is down, only the highlight flags count.

## frame-painting.mjs

```bash
node curation/real-art/frame-painting.mjs --candidates /tmp/cands.json --id aic:20684
node curation/real-art/frame-painting.mjs --candidates /tmp/cands.json --id wd:Q45585
node curation/real-art/frame-painting.mjs --candidates /tmp/cands.json --id rijks:SK-A-2344
node curation/real-art/frame-painting.mjs --record one-record.json --stem caillebotte_paris_street --margin 0.05
```

- Refuses any record whose `clearance.pass` isn't `true`.
- Downloads the largest image the museum serves (AIC through IIIF at an explicit width, since `full/full` is blocked; the Met's `primaryImage`; CMA's `images.print`) and fails if the long edge is under 2000 px.
- From Commons it asks for a rendition about 4000 px on the long edge rather than the original, which can be 40,000+ px. Commons only serves standard widths and rounds up (3840 today). An original of 4000 px or less is taken as is.
- From NGA, the Rijksmuseum, the Getty and SMK it asks their IIIF servers for 4000 px on the long edge (within the limits their `info.json` gives), not their 20,000+ px originals.
- Never upscales or extends the image. It scales it down to fit and centres it on a 3840×2160 `#0b0b0d` wall. `--margin` adds wall, as a fraction of the height.
- Writes `gallery/<stem>_4k.webp` and `gallery/<stem>.provenance.json` (the nine provenance keys, for `publish-piece.mjs --provenance`). The default stem is the artist's surname plus a short title slug.

## Tests

```bash
node --test curation/real-art/
```

Offline fixture tests for the legal gate (`clearance.test.mjs`; `commons.test.mjs` for the Commons checks and naming; `museums.test.mjs` for NGA, the Rijksmuseum, the Getty and SMK). `index.js` exists only so a bare directory argument works on Node 21+.
