#!/usr/bin/env node
// Generates the real-art poster images the marketing pages paint before a video
// buffers: for every clip referenced in lib/gallery-showcase.ts, grab the frame
// at t=0 (it must match the exact first frame of playback, so the hand-off from
// poster to video is seamless) and write a 720px-wide WebP to public/posters/.
//
// Run manually after adding pieces to gallery-showcase.ts, commit the output:
//   node scripts/generate-posters.mjs [--force]
//
// Requires ffmpeg on PATH. Downloads each MP4 once to the system temp dir.

import { execFileSync } from "node:child_process"
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { fileURLToPath } from "node:url"

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const showcase = readFileSync(path.join(root, "lib", "gallery-showcase.ts"), "utf8")

const R2_GALLERY = showcase.match(/R2_GALLERY = "([^"]+)"/)?.[1]
if (!R2_GALLERY) throw new Error("Could not find R2_GALLERY in lib/gallery-showcase.ts")

// Every piece is declared as v("<file>.mp4", ...) — collect the unique files.
const files = [...new Set([...showcase.matchAll(/v\(\s*"([^"]+\.mp4)"/g)].map((m) => m[1]))]
if (files.length === 0) throw new Error("No v(\"*.mp4\" entries found in lib/gallery-showcase.ts")

const outDir = path.join(root, "public", "posters")
mkdirSync(outDir, { recursive: true })

const force = process.argv.includes("--force")
const work = await mkdtemp(path.join(tmpdir(), "lart-posters-"))

let made = 0
let skipped = 0
let failed = 0
try {
  for (const file of files) {
    const out = path.join(outDir, file.replace(/\.mp4$/, ".webp"))
    if (!force && existsSync(out)) {
      skipped++
      continue
    }
    const mp4 = path.join(work, file)
    try {
      const res = await fetch(R2_GALLERY + file)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await pipeline(Readable.fromWeb(res.body), createWriteStream(mp4))
      execFileSync("ffmpeg", [
        "-y", "-v", "error",
        "-i", mp4,
        "-frames:v", "1",
        "-vf", "scale=720:-2",
        "-c:v", "libwebp", "-quality", "80",
        out,
      ])
      const kb = Math.round(statSync(out).size / 1024)
      console.log(`✓ ${path.basename(out)} (${kb} KB)`)
      made++
    } catch (err) {
      console.error(`✗ ${file}: ${err.message}`)
      failed++
    } finally {
      await rm(mp4, { force: true })
    }
  }
} finally {
  await rm(work, { recursive: true, force: true })
}

console.log(`\n${made} generated, ${skipped} already present (use --force to redo), ${failed} failed`)
if (failed > 0) process.exit(1)
