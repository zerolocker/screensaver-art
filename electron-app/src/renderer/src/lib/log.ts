// Renderer-side logging shim. Mirrors to the devtools console AND forwards to
// the main process so every line lands in the same on-disk log + in-memory ring
// buffer that error reports are built from. Best-effort: never throws.

type Level = 'debug' | 'info' | 'warn' | 'error'

function forward(level: Level, scope: string, msg: string, data?: unknown): void {
  // eslint-disable-next-line no-console
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  sink(`[${scope}] ${msg}`, data ?? '')
  try {
    window.electronAPI?.log?.record({ level, scope, msg, data })
  } catch {
    /* preload not ready / not in electron */
  }
}

export const log = {
  debug: (scope: string, msg: string, data?: unknown) => forward('debug', scope, msg, data),
  info: (scope: string, msg: string, data?: unknown) => forward('info', scope, msg, data),
  warn: (scope: string, msg: string, data?: unknown) => forward('warn', scope, msg, data),
  error: (scope: string, msg: string, data?: unknown) => forward('error', scope, msg, data),
}

// Capture uncaught renderer errors + promise rejections so crashes still make
// it into the log/report even when no component handled them.
export function installRendererErrorHandlers(): void {
  window.addEventListener('error', (e) => {
    log.error('window', 'uncaught error', {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error?.stack,
    })
  })
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason as { message?: string; stack?: string } | undefined
    log.error('window', 'unhandledrejection', {
      message: reason?.message ?? String(e.reason),
      stack: reason?.stack,
    })
  })
}
