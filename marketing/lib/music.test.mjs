import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { joinBeds, musicTimeline } from './music.mjs'

test('music changes stay centred on uneven artwork dissolves without accumulating drift', () => {
  const plan = musicTimeline({ durations: [10, 8, 12, 7], videoCrossfade: 1, crossfade: 0.5 })
  assert.equal(plan.duration, 34)
  assert.deepEqual(plan.transitions, [
    { start: 9.25, end: 9.75 }, { start: 16.25, end: 16.75 }, { start: 27.25, end: 27.75 },
  ])
  assert.equal(plan.segments.reduce((sum, s) => sum + s.length, 0) - 3 * plan.crossfade, 34)
})

const hasFFmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0
test('rendered audio has each artwork’s track, both during dissolves, and the exact video length',
  { skip: !hasFFmpeg }, () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'lart-music-test-'))
    const run = (args) => {
      const r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...args], { maxBuffer: 20 * 1024 * 1024 })
      assert.equal(r.status, 0, r.stderr?.toString())
      return r.stdout
    }
    try {
      const frequencies = [220, 440, 660, 880]
      const beds = frequencies.map((frequency, i) => {
        const file = path.join(scratch, `tone-${i}.wav`)
        // Different sample rates and a short track exercise normalisation and looping.
        run(['-f', 'lavfi', '-i', `sine=frequency=${frequency}:sample_rate=${[22050, 32000, 44100, 48000][i]}`,
          '-t', i === 1 ? '3' : '12', file])
        return file
      })
      const outFile = path.join(scratch, 'joined.wav')
      joinBeds({ beds, durations: [10, 8, 12, 7], videoCrossfade: 1, outFile })
      const samples = run(['-i', outFile, '-ac', '1', '-ar', '44100', '-f', 'f32le', 'pipe:1'])
      assert(Math.abs(samples.length / 4 / 44100 - 34) < 0.001, 'audio must end with the video')
      const amplitude = (time, frequency) => {
        const start = Math.round((time - 0.025) * 44100)
        const count = 2205
        let sin = 0, cos = 0
        for (let i = 0; i < count; i++) {
          const value = samples.readFloatLE((start + i) * 4)
          const phase = 2 * Math.PI * frequency * i / 44100
          sin += value * Math.sin(phase)
          cos += value * Math.cos(phase)
        }
        return 2 * Math.hypot(sin, cos) / count
      }
      for (const [i, boundary] of [9, 16, 27].entries()) {
        assert(amplitude(boundary - 0.1, frequencies[i]) > 0.05)
        assert(amplitude(boundary - 0.1, frequencies[i + 1]) < 0.003)
        assert(amplitude(boundary + 0.5, frequencies[i]) > 0.03)
        assert(amplitude(boundary + 0.5, frequencies[i + 1]) > 0.03)
        assert(amplitude(boundary + 1.1, frequencies[i]) < 0.003)
        assert(amplitude(boundary + 1.1, frequencies[i + 1]) > 0.05)
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

test('missing music prompts fail before fetching video or generating paid audio', () => {
  const r = spawnSync('node', ['marketing/make-social-assets.mjs',
    '--src', '/missing-a.mp4', '--src', '/missing-b.mp4',
    '--music-prompt', 'Soft piano. Instrumental, no vocals.'], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /need one --music-prompt per piece/)
  assert.doesNotMatch(r.stdout, /Preparing|generating/)
})
