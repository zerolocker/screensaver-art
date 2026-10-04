import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { log } from './logger'

// OAuth returns as livingart://auth-callback?code=... (PKCE).
export const DEEP_LINK_PROTOCOL = 'livingart'

// A deep link that arrives before the window is ready waits here.
let pendingUrl: string | null = null

/** The livingart:// URL in argv (how Windows and Linux deliver it). */
export function extractDeepLinkFromArgv(argv: string[]): string | null {
  return argv.find((arg) => arg.startsWith(`${DEEP_LINK_PROTOCOL}://`)) ?? null
}

/**
 * Register as the livingart:// handler. In dev, pass execPath and the script
 * path, or Windows registers the bare Electron binary.
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

/** Send the URL to the renderer (or stash it until ready) and bring the window forward. */
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
