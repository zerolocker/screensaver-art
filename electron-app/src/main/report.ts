// Error report assembly + upload.
//
// Gathers a self-contained JSON snapshot of the app's state (versions, OS,
// installer/codesign diagnostics, cache summary, and the recent in-memory log
// buffer from both processes) and POSTs it to the website's /api/error-report
// endpoint, which stores it in the Supabase `user-error-reports` bucket.
//
// The access token is sent as a Bearer header (so the server can attribute the
// report to a user) and is deliberately NOT included in the report body.

import { app } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import * as os from 'os'
import { getDiagnostics, type InstallerDiagnostics } from './installer'
import { PATHS } from './cache-sync'
import { getRecentLogs, getLogFilePath, log, type LogEntry } from './logger'

// The shared diagnostics block attached to both error reports and feedback.
export interface DiagnosticsSnapshot {
  app: { name: string; version: string }
  system: { platform: string; arch: string; osType: string; osRelease: string }
  versions: { electron?: string; chrome?: string; node?: string }
  cache: { dir: string; fileCount: number; sizeBytes: number; manifestExists: boolean }
  diagnostics: InstallerDiagnostics | null
  logFilePath: string | null
  recentLogs: LogEntry[]
}

export interface ErrorReport extends DiagnosticsSnapshot {
  id: string
  createdAt: string
  reason: string
  error: string | null
  rendererContext: unknown
}

export interface SendReportInput {
  endpoint: string
  accessToken: string | null
  reason?: string
  error?: string
  rendererContext?: unknown
}

// A downsampled image attached to feedback (assembled in the renderer; see
// packages/ui/src/image-resize.ts). The data-URL is embedded as-is in the JSON.
export interface FeedbackImage {
  dataUrl: string
  bytes: number
  width: number
  height: number
}

export interface SendFeedbackInput {
  endpoint: string
  accessToken: string | null
  message: string
  image?: FeedbackImage | null
}

export interface FeedbackReport extends DiagnosticsSnapshot {
  kind: 'feedback'
  source: 'app'
  id: string
  createdAt: string
  message: string
  image: FeedbackImage | null
}

async function cacheSummary(): Promise<ErrorReport['cache']> {
  try {
    const names = existsSync(PATHS.VIDEOS_DIR) ? await readdir(PATHS.VIDEOS_DIR) : []
    let sizeBytes = 0
    for (const name of names) {
      try {
        sizeBytes += (await stat(join(PATHS.VIDEOS_DIR, name))).size
      } catch {
        /* ignore individual stat errors */
      }
    }
    return { dir: PATHS.CACHE_DIR, fileCount: names.length, sizeBytes, manifestExists: existsSync(PATHS.MANIFEST_PATH) }
  } catch {
    return { dir: PATHS.CACHE_DIR, fileCount: 0, sizeBytes: 0, manifestExists: false }
  }
}

// Gathers the system/versions/cache/installer/log block shared by error reports
// and feedback. `recentLogsLimit` trims the log tail (feedback embeds an image,
// so it leaves headroom under the bucket's 1 MB cap).
export async function assembleDiagnostics(opts: { recentLogsLimit?: number } = {}): Promise<DiagnosticsSnapshot> {
  const diagnostics = await getDiagnostics().catch((err) => {
    log.warn('report', 'getDiagnostics failed', { error: err instanceof Error ? err.message : String(err) })
    return null
  })
  const allLogs = getRecentLogs()
  const recentLogs = opts.recentLogsLimit ? allLogs.slice(-opts.recentLogsLimit) : allLogs
  return {
    app: { name: app.getName(), version: app.getVersion() },
    system: { platform: process.platform, arch: process.arch, osType: os.type(), osRelease: os.release() },
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    },
    cache: await cacheSummary(),
    diagnostics,
    logFilePath: getLogFilePath(),
    recentLogs,
  }
}

export async function assembleReport(input: Pick<SendReportInput, 'reason' | 'error' | 'rendererContext'>): Promise<ErrorReport> {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    reason: input.reason ?? 'manual',
    error: input.error ?? null,
    rendererContext: input.rendererContext ?? null,
    ...(await assembleDiagnostics()),
  }
}

// Shared upload: POST a JSON payload as the report/feedback body, Bearer-auth'd.
async function postJson(
  endpoint: string,
  accessToken: string | null,
  payload: unknown,
  fallbackId: string,
  label: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
    })
    const data: { id?: string; path?: string; error?: string } = await res.json().catch(() => ({}))
    if (!res.ok) {
      log.error('report', `${label} rejected`, { status: res.status, error: data.error })
      return { ok: false, id: fallbackId, error: data.error || `Upload failed (HTTP ${res.status})` }
    }
    log.info('report', `${label} succeeded`, { id: data.id ?? fallbackId, path: data.path })
    return { ok: true, id: data.id ?? fallbackId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('report', `${label} threw`, { error: message })
    return { ok: false, id: fallbackId, error: message }
  }
}

export async function sendReport(input: SendReportInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const report = await assembleReport(input)
  log.info('report', 'uploading error report', { id: report.id, reason: report.reason })
  return postJson(input.endpoint, input.accessToken, report, report.id, 'upload')
}

export async function sendFeedback(input: SendFeedbackInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const id = randomUUID()
  const report: FeedbackReport = {
    kind: 'feedback',
    source: 'app',
    id,
    createdAt: new Date().toISOString(),
    message: input.message,
    image: input.image ?? null,
    ...(await assembleDiagnostics({ recentLogsLimit: 200 })),
  }
  log.info('report', 'uploading feedback', { id, hasImage: !!report.image, imageBytes: report.image?.bytes })
  return postJson(input.endpoint, input.accessToken, report, id, 'feedback upload')
}
