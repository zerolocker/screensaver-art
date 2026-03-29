import { contextBridge, ipcRenderer } from 'electron'

export interface CacheStats {
  sizeBytes: number
  fileCount: number
  path: string
}

const electronAPI = {
  cache: {
    getStats: (): Promise<CacheStats> => ipcRenderer.invoke('cache:getStats'),
    clear: (): Promise<{ success: boolean }> => ipcRenderer.invoke('cache:clear'),
    getDir: (): Promise<string> => ipcRenderer.invoke('cache:getDir'),
  },
  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
