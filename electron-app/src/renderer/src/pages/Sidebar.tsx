import { useNavigate, useLocation } from 'react-router-dom'
import { Images, User, LifeBuoy, LogOut, Loader2, CheckCircle2, CloudOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn } from '@screensaver-art/ui'
import type { Session } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { useGallerySync } from '../lib/SyncProvider'

interface SidebarProps {
  session: Session
}

// Compact, always-visible status for the background auto-sync. Lives in the
// sidebar so it's readable from any tab while sync runs silently. Renders
// nothing (no empty bordered box) until there's something to report.
function SyncStatus() {
  const { syncing, progress, error, lastSyncedAt } = useGallerySync()

  let content: ReactNode = null
  if (syncing) {
    const detail =
      progress && (progress.phase === 'downloading' || progress.phase === 'cached')
        ? `Syncing ${progress.index}/${progress.total}`
        : 'Syncing gallery…'
    content = (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        <span className="truncate">{detail}</span>
      </div>
    )
  } else if (error) {
    content = (
      <div className="flex items-center gap-2 text-xs text-amber-500">
        <CloudOff className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">Offline — using cached art</span>
      </div>
    )
  } else if (lastSyncedAt) {
    content = (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
        <span className="truncate">Synced {new Date(lastSyncedAt).toLocaleTimeString()}</span>
      </div>
    )
  }

  if (!content) return null
  return <div className="px-4 py-3 border-t border-border">{content}</div>
}

export function Sidebar({ session }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  const links = [
    { path: '/gallery', label: 'Gallery', icon: Images },
    { path: '/account', label: 'Account', icon: User },
    { path: '/help', label: 'Help', icon: LifeBuoy },
  ]

  return (
    <div className="w-56 border-r border-border flex flex-col bg-sidebar">
      {/* Draggable title area — pt pushes below macOS traffic lights */}
      <div className="titlebar-drag pt-8 pb-3 px-4 border-b border-border">
        <h1 className="font-serif text-sm font-bold text-foreground titlebar-no-drag">
          Living Art Screensaver
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {links.map(({ path, label, icon: Icon }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              location.pathname === path
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </nav>

      {/* Background sync status */}
      <SyncStatus />

      {/* User / sign out */}
      <div className="p-3 border-t border-border">
        <p className="text-xs text-muted-foreground truncate px-3 mb-2">
          {session.user.email}
        </p>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}
