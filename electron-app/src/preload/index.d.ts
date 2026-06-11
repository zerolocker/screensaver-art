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

export type CacheProgress =
  | { phase: 'fetching-gallery' }
  | { phase: 'cached' | 'downloading' | 'error'; index: number; total: number; title: string; error?: string }
  | { phase: 'done'; total: number }

export interface CachedManifest {
  items: { filename: string; title: string; type: string }[]
  isSubscribed: boolean
  totalCount: number
  syncedAt: string
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
    ) => Promise<{ ok: true; manifest: CachedManifest } | { ok: false; error: string }>
    onProgress: (cb: (p: CacheProgress) => void) => () => void
  }
  installer: {
    status: () => Promise<InstallerStatus>
    ensureRegistered: () => Promise<{ ok: boolean; error?: string; registered: boolean }>
    activate: () => Promise<{ ok: boolean; error?: string }>
  }
  shell: {
    openExternal: (url: string) => Promise<void>
    openPath: (path: string) => Promise<string>
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
  auth: {
    onCallback: (cb: (url: string) => void) => () => void
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
