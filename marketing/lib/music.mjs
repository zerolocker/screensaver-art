// The per-piece music bed — one Lyria call, scored to the art it sits under.
//
// WHY PER PIECE, NOT A SHARED LIBRARY: an earlier version reused five generic
// ambient beds across every clip, on the theory that nobody notices the bed
// varying nightly. True, but it misses the thing that *is* noticed — a bright,
// noisy plaza full of children playing in a fountain scored with a slow, tender
// solo piano reads as a mistake, because the music contradicts the picture.
// Music that matches the era, mood and energy of the art is worth one API call a
// night; music that doesn't is worth less than silence.
//
// The **prompt** is the durable artifact, not the MP3: it is written back to the
// piece's `gallery.json` entry as `music_prompt` (a curation-only field, like
// `image_prompt` and `video_prompt`), so the score is reproducible from the
// catalog. The audio itself is scratch — generated into a temp dir, muxed into
// the clips, and deleted. Nothing is committed and nothing is uploaded
// (`CLAUDE.md` → Repo rules).

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
 * One prompt in, one MP3 out (~30s, which we loop to clip length).
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
