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
  totalCount: number
  syncedAt: string
}

const electronAPI = {
  cache: {
    getStats: (): Promise<CacheStats> => ipcRenderer.invoke('cache:getStats'),
    clear: (): Promise<{ success: boolean }> => ipcRenderer.invoke('cache:clear'),
    getDir: (): Promise<string> => ipcRenderer.invoke('cache:getDir'),
    sync: (
      apiUrl: string,
      accessToken: string | null,
    ): Promise<{ ok: true; manifest: CachedManifest } | { ok: false; error: string }> =>
      ipcRenderer.invoke('cache:sync', { apiUrl, accessToken }),
    onProgress: (cb: (p: CacheProgress) => void): (() => void) => {
      const handler = (_evt: IpcRendererEvent, p: CacheProgress): void => cb(p)
      ipcRenderer.on('cache:progress', handler)
      return () => ipcRenderer.removeListener('cache:progress', handler)
    },
  },
  installer: {
    status: (): Promise<InstallerStatus> => ipcRenderer.invoke('installer:status'),
    install: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('installer:install'),
    uninstall: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('installer:uninstall'),
    activate: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('installer:activate'),
    openSystemSettings: (): Promise<{ ok: true }> => ipcRenderer.invoke('installer:openSystemSettings'),
  },
  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (path: string): Promise<string> => ipcRenderer.invoke('shell:openPath', path),
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
