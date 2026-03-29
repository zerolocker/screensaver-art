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
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
