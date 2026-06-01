// Dependency-free structured logger for the Electron main process.
//
// Three sinks, all best-effort (logging must never throw / crash the app):
//   1. console — human-readable, shows up in `pnpm dev` and Console.app.
//   2. a JSONL file in <userData>/logs/main.log — survives quit, the durable
//      record we point users at and read back for error reports.
//   3. an in-memory ring buffer of the most recent entries — embedded verbatim
//      in the uploaded error report so we don't have to read the whole file.
//
// Renderer logs are forwarded here over IPC (see recordRendererLog), so a
// single report captures both processes.

import { app } from 'electron'
import { appendFile, mkdir, rename, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  ts: string
  level: LogLevel
  scope: string
  msg: string
  data?: unknown
}

const RING_MAX = 800
const MAX_FILE_BYTES = 5 * 1024 * 1024 // rotate at ~5 MB, keep one backup

const ring: LogEntry[] = []
let logFilePath: string | null = null
let logDir: string | null = null
let writeChain: Promise<void> = Promise.resolve()

// Resolve the log file path lazily and defensively. In unit tests electron's
// `app` is mocked without getPath(), so file logging is simply disabled while
// console + ring-buffer logging keep working.
function ensurePaths(): string | null {
  if (logFilePath) return logFilePath
  try {
    if (app && typeof app.getPath === 'function') {
      logDir = join(app.getPath('userData'), 'logs')
      logFilePath = join(logDir, 'main.log')
    }
  } catch {
    /* not running inside Electron */
  }
  return logFilePath
}

async function rotateIfNeeded(file: string): Promise<void> {
  try {
    if (!existsSync(file)) return
    const { size } = await stat(file)
    if (size > MAX_FILE_BYTES) {
      await rename(file, file + '.1').catch(() => {})
    }
  } catch {
    /* ignore */
  }
}

function format(entry: LogEntry): string {
  const base = `[${entry.ts}] ${entry.level.toUpperCase().padEnd(5)} ${entry.scope}: ${entry.msg}`
  if (entry.data === undefined) return base
  let dataStr: string
  try {
    dataStr = typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data)
  } catch {
    dataStr = String(entry.data)
  }
  return `${base} ${dataStr}`
}

function toConsole(entry: LogEntry): void {
  const line = format(entry)
  // eslint-disable-next-line no-console
  const sink = entry.level === 'error' ? console.error : entry.level === 'warn' ? console.warn : console.log
  sink(line)
}

function appendToFile(entry: LogEntry): void {
  const file = ensurePaths()
  if (!file || !logDir) return
  const dir = logDir
  // Serialize writes so concurrent log calls don't interleave or race the dir
  // creation / rotation.
  writeChain = writeChain
    .then(async () => {
      if (!existsSync(dir)) await mkdir(dir, { recursive: true })
      await rotateIfNeeded(file)
      await appendFile(file, JSON.stringify(entry) + '\n')
    })
    .catch(() => {
      /* logging must never throw */
    })
}

function record(level: LogLevel, scope: string, msg: string, data?: unknown): void {
  const entry: LogEntry = { ts: new Date().toISOString(), level, scope, msg, ...(data !== undefined ? { data } : {}) }
  ring.push(entry)
  if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX)
  toConsole(entry)
  appendToFile(entry)
}

export const log = {
  debug: (scope: string, msg: string, data?: unknown) => record('debug', scope, msg, data),
  info: (scope: string, msg: string, data?: unknown) => record('info', scope, msg, data),
  warn: (scope: string, msg: string, data?: unknown) => record('warn', scope, msg, data),
  error: (scope: string, msg: string, data?: unknown) => record('error', scope, msg, data),
}

// A renderer-originated entry. We re-stamp the timestamp scope so reports make
// it obvious which process a line came from, but otherwise trust the payload.
export function recordRendererLog(input: {
  level?: LogLevel
  scope?: string
  msg?: string
  data?: unknown
}): void {
  const level: LogLevel = ['debug', 'info', 'warn', 'error'].includes(input.level as string)
    ? (input.level as LogLevel)
    : 'info'
  const scope = `renderer:${typeof input.scope === 'string' ? input.scope : 'app'}`
  const msg = typeof input.msg === 'string' ? input.msg : String(input.msg)
  record(level, scope, msg, input.data)
}

export function getRecentLogs(): LogEntry[] {
  return ring.slice()
}

export function getLogFilePath(): string | null {
  return ensurePaths()
}

// Capture last-ditch crashes so they land in the same log + report.
export function installGlobalHandlers(): void {
  process.on('uncaughtException', (err) => {
    log.error('process', 'uncaughtException', { message: err?.message, stack: err?.stack })
  })
  process.on('unhandledRejection', (reason) => {
    const r = reason as { message?: string; stack?: string }
    log.error('process', 'unhandledRejection', { message: r?.message ?? String(reason), stack: r?.stack })
  })
}
