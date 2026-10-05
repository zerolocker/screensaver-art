// Generates the music for one post (a piece, or a night's set stitched into one
// clip) with one Lyria call. The music is written for the art because music that
// clashes with the picture is worse than none. Only the prompt is kept (as
// `music_prompt` on every piece it scored); the MP3 is temporary.

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

/**
 * Seconds of crossfade where a looped bed meets its own start. Lyria returns ~30s
 * and a night's set runs ~40s, so the bed repeats; a hard seam is very audible.
 */
const LOOP_CROSSFADE = 3

function audioLength(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' })
  const seconds = parseFloat(r.stdout)
  if (r.status !== 0 || !(seconds > 0)) throw new Error(`could not read the length of ${path.basename(file)}`)
  return seconds
}

/**
 * Returns a bed at least `length` seconds long: the bed itself if long enough,
 * else copies of it crossfaded end to start, written to `outFile` (WAV).
 */
export function fitBed({ bed, length, outFile }) {
  const bedLength = audioLength(bed)
  if (bedLength >= length) return bed
  const overlap = Math.min(LOOP_CROSSFADE, bedLength / 3)
  const copies = Math.ceil((length - overlap) / (bedLength - overlap))
  const chain = []
  let joined = '0:a'
  for (let i = 1; i < copies; i++) {
    chain.push(`[${joined}][${i}:a]acrossfade=d=${overlap.toFixed(3)}:c1=qsin:c2=qsin[a${i}]`)
    joined = `a${i}`
  }
  const r = spawnSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    ...Array.from({ length: copies }, () => ['-i', bed]).flat(),
    '-filter_complex', chain.join(';'), '-map', `[${joined}]`, '-c:a', 'pcm_s16le', outFile,
  ], { stdio: ['ignore', 'ignore', 'inherit'] })
  if (r.status !== 0) throw new Error('ffmpeg could not loop the music bed')
  return outFile
}
