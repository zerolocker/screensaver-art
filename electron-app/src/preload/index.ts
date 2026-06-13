import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

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

const electronAPI = {
  cache: {
    getStats: (): Promise<CacheStats> => ipcRenderer.invoke('cache:getStats'),
    clear: (): Promise<{ success: boolean }> => ipcRenderer.invoke('cache:clear'),
    getDir: (): Promise<string> => ipcRenderer.invoke('cache:getDir'),
    getSyncState: (): Promise<{ syncing: boolean }> => ipcRenderer.invoke('cache:getSyncState'),
    sync: (
      apiUrl: string,
      accessToken: string | null,
      pruneDeselected = false,
    ): Promise<{ ok: true; manifest: CachedManifest } | { ok: false; error: string }> =>
      ipcRenderer.invoke('cache:sync', { apiUrl, accessToken, pruneDeselected }),
    onProgress: (cb: (p: CacheProgress) => void): (() => void) => {
      const handler = (_evt: IpcRendererEvent, p: CacheProgress): void => cb(p)
      ipcRenderer.on('cache:progress', handler)
      return () => ipcRenderer.removeListener('cache:progress', handler)
    },
  },
  selection: {
    get: (): Promise<{ selected: string[] | null }> => ipcRenderer.invoke('selection:get'),
    set: (selected: string[]): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('selection:set', selected),
  },
  installer: {
    status: (): Promise<InstallerStatus> => ipcRenderer.invoke('installer:status'),
    ensureRegistered: (): Promise<{ ok: boolean; error?: string; registered: boolean }> =>
      ipcRenderer.invoke('installer:ensureRegistered'),
    activate: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('installer:activate'),
  },
  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (path: string): Promise<string> => ipcRenderer.invoke('shell:openPath', path),
  },
  log: {
    record: (entry: RendererLogEntry): Promise<void> => ipcRenderer.invoke('log:record', entry),
    getFilePath: (): Promise<string | null> => ipcRenderer.invoke('log:getFilePath'),
  },
  report: {
    send: (input: SendReportInput): Promise<{ ok: boolean; id?: string; error?: string }> =>
      ipcRenderer.invoke('report:send', input),
  },
  feedback: {
    send: (input: SendFeedbackInput): Promise<{ ok: boolean; id?: string; error?: string }> =>
      ipcRenderer.invoke('feedback:send', input),
  },
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
    restart: (): Promise<void> => ipcRenderer.invoke('app:restart'),
  },
  update: {
    getState: (): Promise<UpdateState> => ipcRenderer.invoke('update:getState'),
    check: (): Promise<void> => ipcRenderer.invoke('update:check'),
    quitAndInstall: (): Promise<void> => ipcRenderer.invoke('update:quitAndInstall'),
    onEvent: (cb: (state: UpdateState) => void): (() => void) => {
      const handler = (_evt: IpcRendererEvent, state: UpdateState): void => cb(state)
      ipcRenderer.on('update:event', handler)
      return () => ipcRenderer.removeListener('update:event', handler)
    },
  },
  auth: {
    // Fires when the OS hands back an OAuth deep link (livingart://auth-callback).
    onCallback: (cb: (url: string) => void): (() => void) => {
      const handler = (_evt: IpcRendererEvent, url: string): void => cb(url)
      ipcRenderer.on('auth:callback', handler)
      return () => ipcRenderer.removeListener('auth:callback', handler)
    },
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
