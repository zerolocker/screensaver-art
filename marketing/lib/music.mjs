// The music bed — one Lyria call per post, scored to the art it sits under (one
// piece, or a night's set stitched into one clip).
//
// WHY WRITTEN FOR THE ART, NOT A SHARED LIBRARY: an earlier version reused five
// generic ambient beds across every clip, on the theory that nobody notices the
// bed varying nightly. True, but it misses the thing that *is* noticed — a bright,
// noisy plaza full of children playing in a fountain scored with a slow, tender
// solo piano reads as a mistake, because the music contradicts the picture.
// Music that matches the era, mood and energy of the art is worth one API call a
// night; music that doesn't is worth less than silence.
//
// The **prompt** is the durable artifact, not the MP3: it is written back as
// `music_prompt` to the `gallery.json` entry of every piece it scored (a
// curation-only field, like `image_prompt` and `video_prompt`), so the score is
// reproducible from the catalog. The audio itself is scratch — generated into a
// temp dir, muxed into the clips, and deleted. Nothing is committed and nothing is
// uploaded (`CLAUDE.md` → Repo rules).

import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from './pieces.mjs'

const SKILL = path.join(REPO_ROOT, '.claude/skills/lyria-music-gen/scripts/generate.py')
const WITH_SECRETS = path.join(REPO_ROOT, 'curation/with-secrets.sh')

/**
 * Bed level in dB. Negative = quieter than the source. −9 dB puts the music
 * clearly under the art rather than over it (strategy §11.2: the picture leads).
 */
export const DEFAULT_GAIN_DB = -9

/**
 * Lyria writes and performs lyrics unless told not to, and a sung bed under the
 * art is unusable. The skill checks the *result* too and exits non-zero if it
 * hears lyrics — this is the cheaper check, before a paid call.
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
 * One prompt in, one MP3 out (~30s; fitBed stretches it to a longer clip).
 *
 * Runs the `lyria-music-gen` skill through the secrets wrapper, exactly as the
 * curation steps do, so GEMINI_API_KEY is verified by name and never passed by
 * hand. A non-zero exit also means "Lyria sang" — the skill writes the audio
 * anyway so the paid call isn't wasted, but we refuse to use it.
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
 * Seconds of overlap where a looped bed runs into its own start. Lyria's clip
 * model returns ~30s and a night's set runs ~40s, so the bed has to repeat; a hard
 * seam on a sustained pad is very audible, an equal-power crossfade much less so.
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
 * A bed at least `length` seconds long: the bed itself if it already is, else
 * enough copies of it, each crossfaded into the next, written to `outFile` (WAV).
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
