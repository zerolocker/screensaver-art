// Forwards UI events to the main process, which sends them to PostHog. Never
// throws; does nothing outside Electron.
export function track(event: string, properties?: Record<string, unknown>): void {
  try {
    void window.electronAPI?.analytics?.capture(event, properties)
  } catch {
    /* preload not ready / not in electron */
  }
}

// On sign-out, start a fresh anonymous identity.
export function resetIdentity(): void {
  try {
    void window.electronAPI?.analytics?.reset?.()
  } catch {
    /* preload not ready / not in electron */
  }
}
