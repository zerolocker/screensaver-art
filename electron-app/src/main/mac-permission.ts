// The video cache lives inside the screensaver's sandbox container, so the
// first time we touch it macOS shows the "access data from other apps"
// (SystemPolicyAppData) prompt. These helpers explain that prompt before it
// appears, and recover when the user has already denied it.

import { app, dialog, BrowserWindow, type MessageBoxOptions } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'

const execFileAsync = promisify(execFile)

const TCC_SERVICE = 'SystemPolicyAppData'

// In a packaged build this is our real bundle id; in dev the running process is
// Electron itself, which is what holds the TCC decision.
function appDataBundleId(): string {
  return app.isPackaged ? 'com.livingart.screensaver.app' : 'com.github.Electron'
}

function explainedFlagPath(): string {
  return join(app.getPath('userData'), 'appdata-prompt-explained')
}

function hasExplained(): boolean {
  return existsSync(explainedFlagPath())
}

function markExplained(): void {
  try {
    writeFileSync(explainedFlagPath(), new Date().toISOString())
  } catch {
    // Best-effort: worst case we show the explainer again next launch.
  }
}

function show(window: BrowserWindow | null, opts: MessageBoxOptions) {
  return window && !window.isDestroyed()
    ? dialog.showMessageBox(window, opts)
    : dialog.showMessageBox(opts)
}

export function isPermissionError(err: unknown): boolean {
  return (
    !!err && typeof err === 'object' && (err as NodeJS.ErrnoException).code === 'EPERM'
  )
}

// Shown once per machine, right before the first container access, so the user
// understands the macOS prompt that's about to appear instead of reflexively
// dismissing it.
async function explainAppDataPromptOnce(window: BrowserWindow | null): Promise<void> {
  if (process.platform !== 'darwin') return
  if (hasExplained()) return
  markExplained()
  await show(window, {
    type: 'info',
    title: 'Heads up — macOS is about to ask for permission',
    message: 'Heads up — macOS is about to ask for permission',
    detail:
      'Next, you will be asked permission for us to access data from other apps. ' +
      'Please click “Allow” — without it we can’t install and manage your screensaver.',
    buttons: ['Continue'],
    defaultId: 0,
  })
}

// The "access data from other apps" permission has no toggle in System Settings,
// so the only programmatic way back after a denial is `tccutil reset`, which
// re-arms the OS prompt on the next access.
async function resetAppDataPermission(): Promise<void> {
  try {
    await execFileAsync('tccutil', ['reset', TCC_SERVICE, appDataBundleId()])
  } catch {
    // Older macOS or an unexpected bundle id: reset the whole service instead.
    await execFileAsync('tccutil', ['reset', TCC_SERVICE]).catch(() => {})
  }
}

async function offerPermissionRecovery(window: BrowserWindow | null): Promise<boolean> {
  const { response } = await show(window, {
    type: 'warning',
    title: 'Permission needed',
    message: 'Living Art Screensaver can’t reach your screensaver’s files',
    detail:
      'macOS is blocking access to the data this app shares with your screensaver. ' +
      'Click “Re-request Permission”, then choose “Allow” when macOS asks again.',
    buttons: ['Re-request Permission', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
  })
  if (response !== 0) return false
  await resetAppDataPermission()
  return true
}

// `tccutil reset` clears the decision, but a process that was already denied may
// keep the cached result until relaunch. If the retry still fails, offer to do
// that relaunch.
async function offerRelaunch(window: BrowserWindow | null): Promise<void> {
  const { response } = await show(window, {
    type: 'info',
    title: 'Almost there — restart required',
    message: 'Please restart Living Art Screensaver',
    detail:
      'macOS needs the app to restart before the new permission takes effect. ' +
      'Restart now, then choose “Allow” when prompted.',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
  })
  if (response === 0) {
    app.relaunch()
    app.exit(0)
  }
}

// For passive reads (e.g. cache stats): explain the prompt once, then attempt
// the operation. Permission errors are surfaced to the caller rather than
// interrupting with a recovery dialog.
export async function explainBeforeAccess(window: BrowserWindow | null): Promise<void> {
  await explainAppDataPromptOnce(window)
}

// For user-initiated actions (Sync Now, Clear Cache): explain once, run, and on
// an EPERM offer to re-request permission and retry.
export async function withAppDataAccess<T>(
  window: BrowserWindow | null,
  op: () => Promise<T>,
): Promise<T> {
  await explainAppDataPromptOnce(window)
  try {
    return await op()
  } catch (err) {
    if (process.platform !== 'darwin' || !isPermissionError(err)) throw err
    const reRequested = await offerPermissionRecovery(window)
    if (!reRequested) throw err
    try {
      return await op()
    } catch (retryErr) {
      if (!isPermissionError(retryErr)) throw retryErr
      await offerRelaunch(window)
      throw retryErr
    }
  }
}
