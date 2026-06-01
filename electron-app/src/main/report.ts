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

export interface ErrorReport {
  id: string
  createdAt: string
  reason: string
  error: string | null
  app: { name: string; version: string }
  system: { platform: string; arch: string; osType: string; osRelease: string }
  versions: { electron?: string; chrome?: string; node?: string }
  cache: { dir: string; fileCount: number; sizeBytes: number; manifestExists: boolean }
  diagnostics: InstallerDiagnostics | null
  logFilePath: string | null
  recentLogs: LogEntry[]
  rendererContext: unknown
}

export interface SendReportInput {
  endpoint: string
  accessToken: string | null
  reason?: string
  error?: string
  rendererContext?: unknown
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

export async function assembleReport(input: Pick<SendReportInput, 'reason' | 'error' | 'rendererContext'>): Promise<ErrorReport> {
  const diagnostics = await getDiagnostics().catch((err) => {
    log.warn('report', 'getDiagnostics failed', { error: err instanceof Error ? err.message : String(err) })
    return null
  })
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    reason: input.reason ?? 'manual',
    error: input.error ?? null,
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
    recentLogs: getRecentLogs(),
    rendererContext: input.rendererContext ?? null,
  }
}

export async function sendReport(input: SendReportInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const report = await assembleReport(input)
  log.info('report', 'uploading error report', { id: report.id, reason: report.reason })
  try {
    const res = await fetch(input.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
      },
      body: JSON.stringify(report),
    })
    const data: { id?: string; path?: string; error?: string } = await res.json().catch(() => ({}))
    if (!res.ok) {
      log.error('report', 'upload rejected', { status: res.status, error: data.error })
      return { ok: false, id: report.id, error: data.error || `Upload failed (HTTP ${res.status})` }
    }
    log.info('report', 'upload succeeded', { id: data.id ?? report.id, path: data.path })
    return { ok: true, id: data.id ?? report.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('report', 'upload threw', { error: message })
    return { ok: false, id: report.id, error: message }
  }
}
