# curation/real-art — find, clear and frame real public-domain paintings

These scripts cover the first half of the real-paintings nightly curation
(`curation/REAL_PAINTINGS_CURATION.md`):

1. **find + gate**: `find-paintings.mjs`
2. curator picks four (taste + motion; not code)
3. **frame**: `frame-painting.mjs`
4. Veo, then `publish-piece.mjs --provenance`

They need Node ≥ 18 and `ffmpeg`/`ffprobe` on PATH. There are no npm deps and no
API keys.

## find-paintings.mjs

```bash
node curation/real-art/find-paintings.mjs --famous --out /tmp/cands.json          # most famous eligible works
node curation/real-art/find-paintings.mjs --query "harbor boats" --limit 30        # a theme
node curation/real-art/find-paintings.mjs --famous --query storm                   # famous works on a theme
node curation/real-art/find-paintings.mjs --ids aic:27992,aic:111628,met:435702,cma:1922.1133 --show-rejects
```

| flag | |
|---|---|
| `--sources aic,cma,met` | which museums to search (default: all three) |
| `--query <theme>` | keywords searched in every source |
| `--famous` | ranks by Wikipedia-edition count + museum highlight flags. This is the default when neither `--query` nor `--ids` is given |
| `--ids src:id,…` | clears specific works: `aic:<id>`, `met:<objectID>`, `cma:<id or accession no.>` |
| `--limit N` | max eligible records written (default 40) |
| `--pool N` | raw candidates hydrated per source (default max(40, 2×limit)) |
| `--out <file>` | output file (default: stdout). Progress and a top-15 summary go to stderr |
| `--show-rejects` | audit mode: rejected records are appended, with their reasons |

The sources:

- Art Institute of Chicago: the search API, plus `/agents` for corroborating life dates.
- Cleveland Museum of Art: queried with `cc0=1`.
- The Met: uses `/public/collection/v1.1/search` with offset/limit. The v1
  search endpoint was retired on 2026-10-01. Objects still come from
  `/v1/objects/:id`.

The Met's WAF blocks the whole IP after about 80 requests a minute. So the scripts
pace the Met at about 1 request per second, which makes it the slow source. If the
Met walls the client off anyway, its circuit breaker skips the Met for the rest of
the run and the other sources still report.

Output is a JSON array. Each record holds:

- **the nine provenance keys** that publish-piece copies into `gallery.json`:
  `source` (`"real_artwork"`), `artist`, `artist_dates`, `original_title`,
  `original_date`, `museum`, `credit_line`, `source_url`, `license`
  (`"Public Domain"` | `"CC0"`)
- **working keys**: `object_id`, `image_url`, `width`, `height`, `aspect`,
  `classification`, `medium`, `fame: {wikipedia_langs, highlight}`,
  `clearance: {pass, reasons[], evidence{}}`

**The legal gate** (`clearance.mjs`, pinned by `clearance.test.mjs`) is strict:
anything in doubt is rejected. A work passes only if all four checks hold.

1. **Licence.** The museum's own flag is exactly Public Domain / CC0: AIC
   `is_public_domain`, Met `isPublicDomain`, CMA `share_license_status == "CC0"`.
2. **Life+70.** Every listed artist died in or before the current year − 71
   (1955 in 2026).
   - A circa death year gets +10 years.
   - An unknown death year is only accepted if the artist was physically certain
     to be dead by the cutoff. That is bounded by birth, floruit or object date,
     assuming a 110-year lifespan, so an unknown death on a post-1900 object
     always fails.
   - Anonymous works, "attributed to / workshop of / after / circle of" works,
     and works with undated printers or publishers also need an object end date
     before 1900.
3. **Flat art only.** Paintings, prints (including ukiyo-e), drawings and
   watercolours pass. Sculpture, textiles, decorative arts and photographs (or
   photomechanical prints) fail.
4. **Size.** The image's long edge is at least 2000 px. The Met's sizes are read
   from the JPEG header with a Range request.

**Dedup** happens in two places:

- A record is skipped if its `source_url` is already in the repo's `gallery.json`.
- The same work held by several museums is collapsed to its most famous copy,
  matched on artist surname + normalised title.

**Fame** is the number of Wikipedia language editions with an article on the
work, plus 5 for a museum highlight flag. It's computed in batched WDQS queries
(`wikidata.mjs`), joining through each museum's object-ID property:

- AIC: P4610
- the Met: P3634
- CMA: P11110

AIC and CMA also join on inventory number (P217) qualified by collection (P195).
If Wikidata is down, ranking falls back to the highlight flags alone.

## frame-painting.mjs

```bash
node curation/real-art/frame-painting.mjs --candidates /tmp/cands.json --id aic:20684
node curation/real-art/frame-painting.mjs --record one-record.json --stem caillebotte_paris_street --margin 0.05
```

The script refuses any record whose `clearance.pass` isn't `true`. Then it
downloads the highest-resolution image the source serves:

- AIC: IIIF at native width. `full/full` is WAF-blocked, so the width is asked
  for explicitly, within the server's `maxArea`. If that fails, it steps down
  the advertised sizes.
- The Met: `primaryImage`.
- CMA: `images.print`.

It exits non-zero if the long edge is under 2000 px. The image is **never
upscaled or extended**. It's contain-fitted (lanczos downscale only) and centred
on a 3840×2160 `#0b0b0d` wall. `--margin` is extra wall as a fraction of the
canvas height.

It writes two files to the gitignored `gallery/` folder:

- `gallery/<stem>_4k.webp`
- `gallery/<stem>.provenance.json`, holding only the nine provenance keys and
  ready for `publish-piece.mjs --provenance`

Then it deletes the raw download. The default stem is the artist surname + a
short title slug.

## Tests

```bash
node --test curation/real-art/
```

The tests are offline fixtures for the copyright gate. `index.js` exists only so
that a bare directory argument works on Node ≥ 21.
