export interface CacheStats {
  sizeBytes: number
  fileCount: number
  path: string
}

export interface ElectronAPI {
  cache: {
    getStats: () => Promise<CacheStats>
    clear: () => Promise<{ success: boolean }>
    getDir: () => Promise<string>
  }
  shell: {
    openExternal: (url: string) => Promise<void>
    openPath: (path: string) => Promise<string>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
