// Generates one Lyria track per artwork and joins a set's tracks in playback
// order. Only each artwork's own music_prompt is kept; the audio is temporary.

import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from './pieces.mjs'

const SKILL = path.join(REPO_ROOT, '.claude/skills/lyria-music-gen/scripts/generate.py')
const WITH_SECRETS = path.join(REPO_ROOT, 'curation/with-secrets.sh')

/** Music level in dB: well under the art. */
export const DEFAULT_GAIN_DB = -9

/** Seconds of overlap between different artworks' music. */
export const MUSIC_CROSSFADE = 1

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
 * and longer segments or a manually shared bed may need repeats; avoid a hard seam.
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

/**
 * Centre each music crossfade on the corresponding visual dissolve. If the
 * audio and video overlaps differ, trimming tracks to their source clip lengths
 * would make the music drift later at every artwork change.
 */
export function musicTimeline({ durations, videoCrossfade, crossfade = MUSIC_CROSSFADE }) {
  if (durations.length < 2 || durations.some((d) => !Number.isFinite(d) || d <= videoCrossfade) ||
      !Number.isFinite(videoCrossfade) || videoCrossfade <= 0 ||
      !Number.isFinite(crossfade) || crossfade <= 0 || crossfade > videoCrossfade) {
    throw new Error('invalid music timeline: need at least two clips longer than the visual crossfade, ' +
      'and a positive music crossfade no longer than the visual dissolve')
  }
  const starts = [0]
  for (let i = 1; i < durations.length; i++) {
    starts.push(starts[i - 1] + durations[i - 1] - videoCrossfade)
  }
  const duration = starts.at(-1) + durations.at(-1)
  const transitions = starts.slice(1).map((start) => ({
    start: start + (videoCrossfade - crossfade) / 2,
    end: start + (videoCrossfade + crossfade) / 2,
  }))
  const segments = durations.map((_, i) => {
    const start = i === 0 ? 0 : transitions[i - 1].start
    const end = i === durations.length - 1 ? duration : transitions[i].end
    return { start, end, length: end - start }
  })
  return { duration, crossfade, transitions, segments }
}

/** Join one track per artwork into a WAV matching the set's exact video timing. */
export function joinBeds({ beds, durations, videoCrossfade, outFile }) {
  if (beds.length !== durations.length) throw new Error('need one music track per artwork')
  const timeline = musicTimeline({ durations, videoCrossfade,
    crossfade: Math.min(MUSIC_CROSSFADE, videoCrossfade) })
  const fitted = beds.map((bed, i) => fitBed({ bed, length: timeline.segments[i].length,
    outFile: path.join(path.dirname(outFile), `bed-${i}-fitted.wav`) }))
  const chain = fitted.map((_, i) =>
    `[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,` +
    `atrim=duration=${timeline.segments[i].length.toFixed(6)},asetpts=PTS-STARTPTS[m${i}]`)
  let joined = 'm0'
  for (let i = 1; i < beds.length; i++) {
    chain.push(`[${joined}][m${i}]acrossfade=d=${timeline.crossfade.toFixed(6)}:c1=qsin:c2=qsin[j${i}]`)
    joined = `j${i}`
  }
  const r = spawnSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    ...fitted.flatMap((bed) => ['-i', bed]),
    '-filter_complex', chain.join(';'), '-map', `[${joined}]`, '-c:a', 'pcm_s16le', outFile,
  ], { stdio: ['ignore', 'ignore', 'inherit'] })
  if (r.status !== 0) throw new Error('ffmpeg could not crossfade the artwork music tracks')
  return outFile
}
