# Real-paintings catalog

The nightly real-paintings curation ([`REAL_PAINTINGS_CURATION.md`](REAL_PAINTINGS_CURATION.md)) doesn't search the museums. It picks from a catalog of works that already passed the legal gate: `real-art/catalog.json`. A routine rebuilds the catalog on the 1st of each month.

The catalog is committed to the repo. Each refresh is then a pull request you can review, and the nightly gets it with the `git pull` it already runs.

## Where to look

| File | What it is |
|---|---|
| [`real-art/QUEUE.md`](real-art/QUEUE.md) | The upcoming queue, with thumbnails. The nightly regenerates it each time it publishes. |
| [`real-art/blocklist.txt`](real-art/blocklist.txt) | Works the nightly must never pick. Add a line to veto one. |
| [`real-art/catalog.json`](real-art/catalog.json) | Every cleared work: provenance, clearance evidence, fame, wing, image URL and size. No images. |

The queue is the catalog minus the works already in `gallery.json` and the works on the blocklist. It's ranked by fame, taking turns by wing. The nightly picks four from the top, but uses judgement, so not strictly in order.

In a terminal, `node curation/real-art/queue.mjs` prints the next 40.

## Veto a work

Add a line to `real-art/blocklist.txt`: the work's ID from `QUEUE.md`, then `#` and why.

```
wd:Q12418     # nudity
rijks:SK-C-5  # too dark for a screen
```

- A `wd:Q…` line blocks the work from every source, including a museum's copy of it.
- The URL of the work's page works too.
- Commit it to `master`, on GitHub or locally. The next nightly run honours it. The catalog needn't be rebuilt.
- Delete the line to lift the veto.

## Refresh

The routine below does this. To refresh by hand, run the same commands from the repo root.

1. **Build.** It takes about 11 minutes, so run it in the background and wait for it.
   ```bash
   node curation/real-art/build-catalog.mjs --summary /tmp/catalog-summary.md
   ```
   - It searches all eight sources for their most famous works and clears every one again from scratch. A museum that changed a rights flag, and a rule that changed, both take effect.
   - It refuses to replace the catalog after a partial outage: a source failed, a host blocked it, or a source passed under half as many works as last time. It then exits with an error and changes nothing. Wait about 15 minutes, then run it once more. If it fails again, stop and report the error. The nightly keeps the current catalog.
   - `--force` writes the catalog anyway. Only a person decides that, for example after a rule change that should drop many works.
2. **Test.** `node --test curation/real-art/` must pass.
3. **Open a pull request.** Commit only `curation/real-art/catalog.json` to a new branch, push it, and open a pull request against `master` titled "Real-art catalog: <month> <year>", with `/tmp/catalog-summary.md` as its description. Don't merge it.

The summary shows each source's counts, the works added and removed, and the top 30 of the new queue. Each removed work says why it left: published, now fails the gate, a duplicate, or no longer among the most famous.

**To review it,** read the summary, add any vetoes to `blocklist.txt` (in the PR or on `master`), and merge. The nightly uses the new catalog from its next run.

If you change the legal gate (`real-art/clearance.mjs`) or a source's adapter, rebuild the catalog in the same PR.

## What the nightly checks

- **No catalog, or no works left:** the night stops and reports it. It never falls back to searching the museums.
- **Older than 34 days:** the night warns at the top of its report, then carries on. An old catalog never lets in a work that's too recent: each new year only makes more works eligible. It can miss a rights flag a museum withdrew since the build.
- **`clearance.mjs` changed since the build:** it warns the same way.
- **Fewer than 40 works left:** it warns.

## Set up the monthly routine

[Routines](https://code.claude.com/docs/en/routines) run Claude Code in Anthropic's cloud on a schedule, so the refresh runs with the laptop closed.

1. Open [claude.ai/code/routines](https://claude.ai/code/routines) and click **New routine**. (In the Desktop app: **Code** tab, **Routines**, **New routine**, **Cloud**.)
2. **Name:** `Real-art catalog refresh`. **Model:** a Sonnet model is enough. **Prompt:**
   > Refresh the real-paintings catalog. Follow the *Refresh* section of `curation/REAL_PAINTINGS_CATALOG.md` exactly. Open the pull request only if the build and the tests pass; otherwise report the error and change nothing.
3. **Repository:** `zerolocker/screensaver-art`. If claude.ai asks you to connect GitHub, do: the routine clones the repo and opens the pull request as you.
4. **Environment:** the build calls the museums, Wikidata and Commons directly, which the default **Trusted** network access blocks. Select the environment under the prompt box, open its settings, set **Network access** to **Custom**, check **Also include default list of common package managers**, and enter these **Allowed domains**, one per line:
   ```
   *.artic.edu
   *.metmuseum.org
   openaccess-api.clevelandart.org
   raw.githubusercontent.com
   *.rijksmuseum.nl
   iiif.micr.io
   *.getty.edu
   *.smk.dk
   *.wikidata.org
   *.wikimedia.org
   ```
   `raw.githubusercontent.com` carries the National Gallery of Art's data export.
5. **Trigger:** **Schedule**. The form has no monthly preset: pick **Weekly**, save, then run `/schedule update` in a Claude Code terminal and ask for "the 1st of every month at 9:07" (cron `7 9 1 * *`).
6. **Connectors:** remove them all. The routine needs none.
7. Click **Create**, then **Run now** and open the run's session to check that it opens a pull request. The routine clones `master`, so this works once the catalog scripts are merged.

The routine pushes a `claude/` branch and opens the pull request as your GitHub user. A green run in the list only means the session ended cleanly: open it to see whether the build passed.

If the cloud build keeps failing because a museum blocks cloud addresses (the Met is the most likely), create the routine as **Local** instead of **Cloud**. It then runs on the Mac that runs the nightly, which must be awake on the 1st, and needs no network settings.
