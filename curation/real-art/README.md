# curation/real-art

Scripts for the first half of the real-paintings curation ([`REAL_PAINTINGS_CURATION.md`](../REAL_PAINTINGS_CURATION.md)): find paintings, clear them legally, and frame them. The curator picks the four, then animates them with Omni and publishes with `publish-piece.mjs --provenance`.

Needs Node 18+ and `ffmpeg`/`ffprobe`. No npm packages, no API keys.

## find-paintings.mjs

```bash
node curation/real-art/find-paintings.mjs --famous --out /tmp/cands.json      # most famous eligible works
node curation/real-art/find-paintings.mjs --query "harbor boats" --limit 30    # a theme
node curation/real-art/find-paintings.mjs --ids aic:27992,met:435702,cma:1922.1133 --show-rejects
```

| Flag | |
|---|---|
| `--sources aic,cma,met` | Museums to search (default: all three) |
| `--query <theme>` | Keywords searched in every source |
| `--famous` | Rank by fame. The default when there's no `--query` or `--ids`. |
| `--ids src:id,…` | Check specific works: `aic:<id>`, `met:<objectID>`, `cma:<id or accession no.>` |
| `--limit N` | Max eligible records written (default 40) |
| `--pool N` | Raw candidates fetched per source (default max(40, 2×limit)) |
| `--out <file>` | Output file (default stdout). Progress goes to stderr. |
| `--show-rejects` | Also output rejected records with their reasons |

Sources: the Art Institute of Chicago, the Cleveland Museum of Art (`cc0=1`), and the Met (search on `/public/collection/v1.1/search`, objects on `/v1/objects/:id`). The Met blocks an IP after about 80 requests a minute, so it's paced at one request a second; if it blocks us anyway, the run skips the Met and continues.

Each output record has:
- **Nine provenance keys** that `publish-piece.mjs` copies into `gallery.json`: `source` (`"real_artwork"`), `artist`, `artist_dates`, `original_title`, `original_date`, `museum`, `credit_line`, `source_url`, `license` (`"Public Domain"` or `"CC0"`).
- **Working keys:** `object_id`, `image_url`, `width`, `height`, `aspect`, `classification`, `medium`, `fame`, `clearance`.

### The legal gate

`clearance.mjs` (tested by `clearance.test.mjs`) rejects anything in doubt. A work passes only if:

1. **Licence:** the museum's own flag is Public Domain or CC0 (AIC `is_public_domain`, Met `isPublicDomain`, CMA `share_license_status == "CC0"`).
2. **Life + 70:** every listed artist died in or before the current year − 71.
   - A "circa" death year counts as 10 years later.
   - An unknown death year passes only if the artist must have been dead by the cutoff, assuming a 110-year lifespan from their birth, active years or the work's date. So an unknown death on a post-1900 work always fails.
   - A structured birth or death year after the current year or before 3000 BC is a placeholder and counts as unknown. AIC gives undated agents `4713` for both.
   - Anonymous works, "attributed to / workshop of / after / circle of" works, and works with undated printers need a work date before 1900. The qualifier counts wherever the museum puts it: the label, the AIC agent title, the Met's prefix or name, or CMA's qualifier or description.
3. **Flat art:** paintings, prints (including ukiyo-e), drawings and watercolours. Not sculpture, textiles, decorative arts or photographs.
4. **Size:** the long edge is at least 2000 px. The Met's sizes are read from the JPEG header.

### Duplicates and fame

- Works already in `gallery.json` (matched by `source_url`) are skipped. A work held by several museums keeps only its most famous copy (matched by artist surname and title).
- Fame is the number of Wikipedia language editions about the work, plus 5 for a museum highlight flag. It comes from Wikidata (`wikidata.mjs`) through each museum's object-ID property (AIC P4610, Met P3634, CMA P11110, plus inventory number P217 for AIC and CMA). If Wikidata is down, only the highlight flags count.

## frame-painting.mjs

```bash
node curation/real-art/frame-painting.mjs --candidates /tmp/cands.json --id aic:20684
node curation/real-art/frame-painting.mjs --record one-record.json --stem caillebotte_paris_street --margin 0.05
```

- Refuses any record whose `clearance.pass` isn't `true`.
- Downloads the largest image the museum serves (AIC through IIIF at an explicit width, since `full/full` is blocked; the Met's `primaryImage`; CMA's `images.print`) and fails if the long edge is under 2000 px.
- Never upscales or extends the image. It scales it down to fit and centres it on a 3840×2160 `#0b0b0d` wall. `--margin` adds wall, as a fraction of the height.
- Writes `gallery/<stem>_4k.webp` and `gallery/<stem>.provenance.json` (the nine provenance keys, for `publish-piece.mjs --provenance`). The default stem is the artist's surname plus a short title slug.

## Tests

```bash
node --test curation/real-art/
```

Offline fixture tests for the legal gate. `index.js` exists only so a bare directory argument works on Node 21+.
