export interface CacheStats {
  sizeBytes: number
  fileCount: number
  path: string
}

export interface InstallerStatus {
  platform: NodeJS.Platform
  supported: boolean
  bundledExtensionExists: boolean
  registered: boolean
  active: boolean
  registeredPath: string | null
}

export interface ScreensaverTiming {
  // Idle seconds before the screensaver starts (0 = never; null = unknown).
  screensaverStartSec: number | null
  // Idle minutes before the display turns off (0 = never; null = unknown).
  displayOffMin: number | null
}

export type CacheProgress =
  | { phase: 'fetching-gallery' }
  | { phase: 'cached' | 'downloading' | 'error'; index: number; total: number; title: string; error?: string }
  | { phase: 'done'; total: number }

export interface CachedManifest {
  items: { filename: string; title: string; type: string }[]
  isSubscribed: boolean
  syncedAt: string
}

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
export interface UpdateState {
  status: UpdateStatus
  version?: string
  percent?: number
  error?: string
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export interface RendererLogEntry {
  level: LogLevel
  scope?: string
  msg: string
  data?: unknown
}

export interface SendReportInput {
  endpoint: string
  accessToken: string | null
  reason?: string
  error?: string
  rendererContext?: unknown
}

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

export interface ElectronAPI {
  cache: {
    getStats: () => Promise<CacheStats>
    clear: () => Promise<{ success: boolean }>
    getDir: () => Promise<string>
    getSyncState: () => Promise<{ syncing: boolean }>
    sync: (
      apiUrl: string,
      accessToken: string | null,
      pruneDeselected?: boolean,
    ) => Promise<{ ok: true; manifest: CachedManifest } | { ok: false; error: string }>
    onProgress: (cb: (p: CacheProgress) => void) => () => void
  }
  selection: {
    get: () => Promise<{ selected: string[] | null }>
    set: (selected: string[]) => Promise<{ ok: boolean; error?: string }>
  }
  installer: {
    status: () => Promise<InstallerStatus>
    ensureRegistered: () => Promise<{ ok: boolean; error?: string; registered: boolean }>
    activate: () => Promise<{ ok: boolean; error?: string }>
  }
  screensaver: {
    timing: () => Promise<ScreensaverTiming>
    preview: () => Promise<{ ok: boolean; error?: string }>
  }
  shell: {
    openExternal: (url: string) => Promise<void>
    openPath: (path: string) => Promise<string>
  }
  // Drives the gallery's "Fullscreen" preview mode (native macOS fullscreen).
  window: {
    setFullScreen: (value: boolean) => Promise<void>
  }
  log: {
    record: (entry: RendererLogEntry) => Promise<void>
    getFilePath: () => Promise<string | null>
  }
  report: {
    send: (input: SendReportInput) => Promise<{ ok: boolean; id?: string; error?: string }>
  }
  feedback: {
    send: (input: SendFeedbackInput) => Promise<{ ok: boolean; id?: string; error?: string }>
  }
  app: {
    getVersion: () => Promise<string>
    restart: () => Promise<void>
  }
  update: {
    getState: () => Promise<UpdateState>
    check: () => Promise<void>
    quitAndInstall: () => Promise<void>
    onEvent: (cb: (state: UpdateState) => void) => () => void
  }
  auth: {
    onCallback: (cb: (url: string) => void) => () => void
  }
  analytics: {
    capture: (event: string, properties?: Record<string, unknown>) => Promise<void>
    reset: () => Promise<void>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
