import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { log } from './logger'

// Custom URL scheme the OS hands back to us after an OAuth round-trip in the
// system browser: livingart://auth-callback?code=... (PKCE).
export const DEEP_LINK_PROTOCOL = 'livingart'

// If a deep link arrives before the renderer is ready (cold start on Windows,
// or open-url firing before the window finishes loading), stash it here and
// flush once the window can receive it.
let pendingUrl: string | null = null

/** Pull a livingart:// URL out of a process argv array (Windows/Linux delivery). */
export function extractDeepLinkFromArgv(argv: string[]): string | null {
  return argv.find((arg) => arg.startsWith(`${DEEP_LINK_PROTOCOL}://`)) ?? null
}

/**
 * Register this app as the OS handler for livingart://. In dev the Electron
 * binary is generic, so we must pass execPath + the script path explicitly or
 * Windows registers the wrong command.
 */
export function registerDeepLinkProtocol(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL, process.execPath, [
      join(process.argv[1]),
    ])
  } else {
    app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL)
  }
}

/**
 * Forward a deep-link URL to the renderer (which parses the PKCE `code` and calls
 * supabase.exchangeCodeForSession). Stashes it if the window isn't ready yet, and
 * brings the window to the front so the user lands back on the app after the browser.
 */
export function handleDeepLinkUrl(url: string, getWindow: () => BrowserWindow | null): void {
  log.info('deeplink', 'received deep link', { scheme: url.split('://')[0] })
  const win = getWindow()
  if (!win || win.webContents.isLoading()) {
    pendingUrl = url
    if (win) {
      win.webContents.once('did-finish-load', () => flushPendingDeepLink(win))
    }
    return
  }
  deliver(win, url)
}

/** Send any stashed deep link once the window has finished loading. */
export function flushPendingDeepLink(win: BrowserWindow): void {
  if (!pendingUrl) return
  const url = pendingUrl
  pendingUrl = null
  deliver(win, url)
}

function deliver(win: BrowserWindow, url: string): void {
  if (win.isMinimized()) win.restore()
  win.focus()
  win.webContents.send('auth:callback', url)
}
