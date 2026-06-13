// Selection store — which gallery pieces the user has chosen to play.
//
// Persisted in userData (survives app updates) as an explicit list of selected
// item `src` URLs, or absent when the user has never customized it. cache-sync
// reads this to decide what to download; a null/absent selection defaults to the
// first FREE_COUNT items (see cache-sync.ts). New art added to the gallery later
// simply isn't in the stored list, so it joins the gallery unselected — exactly
// the desired "auto-join at the bottom, off by default" behavior.

import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'fs'
import { join } from 'path'
import { log } from './logger'

function selectionFile(): string {
  return join(app.getPath('userData'), 'selection.json')
}

// Returns the stored selection (a list of selected `src` URLs), or null when the
// user has never customized it — callers treat null as "use the default".
export function readSelection(): string[] | null {
  try {
    const file = selectionFile()
    if (!existsSync(file)) return null
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    if (parsed && Array.isArray(parsed.selected)) {
      return parsed.selected.filter((s: unknown): s is string => typeof s === 'string')
    }
    return null
  } catch (err) {
    log.warn('selection', 'could not read selection', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

// Persists the explicit selection (temp + rename so a crash mid-write can't leave
// a half-written file). Writing an empty array is meaningful: "nothing selected"
// (the screensaver then shows its empty-state prompt), distinct from a null/absent
// selection which means "use the default first FREE_COUNT".
export function writeSelection(selected: string[]): void {
  const file = selectionFile()
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify({ selected }))
  renameSync(tmp, file)
}

// Resets to the default (first FREE_COUNT) by removing the stored selection.
// Not currently wired to UI, but kept symmetric with read/write for tests/tools.
export function clearSelection(): void {
  const file = selectionFile()
  if (existsSync(file)) unlinkSync(file)
}
