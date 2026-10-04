// Generates a piece's music with one Lyria call. Music is written per piece
// because music that clashes with the picture is worse than none. Only the
// prompt is kept (as `music_prompt` in gallery.json); the MP3 is temporary.

import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from './pieces.mjs'

const SKILL = path.join(REPO_ROOT, '.claude/skills/lyria-music-gen/scripts/generate.py')
const WITH_SECRETS = path.join(REPO_ROOT, 'curation/with-secrets.sh')

/** Music level in dB: well under the art. */
export const DEFAULT_GAIN_DB = -9

/**
 * Lyria sings unless told not to. The skill also rejects a sung result; this
 * check is the cheap one, before the paid call.
 */
export function assertInstrumental(prompt) {
  if (!/instrumental/i.test(prompt)) {
    throw new Error(
      'the music prompt must say "instrumental, no vocals" — Lyria sings by default.\n' +
      `  got: ${JSON.stringify(prompt)}`,
    )
  }
}

/**
 * One prompt in, one ~30s MP3 out, via the `lyria-music-gen` skill and the
 * secrets wrapper. A non-zero exit can mean Lyria sang; the file is then refused.
 */
export function generateBed({ prompt, outFile, model = 'clip' }) {
  assertInstrumental(prompt)
  if (!existsSync(SKILL)) throw new Error(`lyria-music-gen skill not found at ${SKILL}`)

  const r = spawnSync('bash', [
    WITH_SECRETS, 'GEMINI_API_KEY', '--',
    'python3', SKILL, '--prompt', prompt, '--out', outFile, '--model', model,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })

  if (r.status !== 0) {
    throw new Error(`music generation failed (exit ${r.status}) — see the skill's output above. ` +
      'A non-zero exit can also mean Lyria sang; rework the prompt rather than shipping vocals.')
  }
  if (!existsSync(outFile) || statSync(outFile).size === 0) {
    throw new Error(`music generation produced no audio at ${outFile}`)
  }
  return outFile
}
