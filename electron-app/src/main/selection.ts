// The pieces the user chose to play: a list of `src` URLs in userData, or absent
// if never customized (cache-sync then uses the free pieces). New pieces aren't
// in the list, so they start unselected.

import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'fs'
import { join } from 'path'
import { log } from './logger'

function selectionFile(): string {
  return join(app.getPath('userData'), 'selection.json')
}

// Null means never customized.
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

// Written via temp file + rename. An empty array means "nothing selected", unlike null.
export function writeSelection(selected: string[]): void {
  const file = selectionFile()
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify({ selected }))
  renameSync(tmp, file)
}

// Back to the default. Not used by the UI.
export function clearSelection(): void {
  const file = selectionFile()
  if (existsSync(file)) unlinkSync(file)
}
