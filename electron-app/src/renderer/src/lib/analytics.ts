// Renderer-side analytics shim. There's no PostHog SDK in the renderer — this
// forwards UI events to the main process (`analytics:capture`), where posthog-node
// captures them with the app's single device/user identity. Best-effort: never
// throws and is a no-op outside Electron (e.g. unit tests / Vite preview).
export function track(event: string, properties?: Record<string, unknown>): void {
  try {
    void window.electronAPI?.analytics?.capture(event, properties)
  } catch {
    /* preload not ready / not in electron */
  }
}
