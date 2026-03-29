import { useNavigate, useLocation } from 'react-router-dom'
import { Images, User, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn } from '@screensaver-art/ui'
import type { Session } from '@supabase/supabase-js'

interface SidebarProps {
  session: Session
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
  ]

  return (
    <div className="w-56 border-r border-border flex flex-col bg-sidebar">
      {/* Draggable title area */}
      <div className="titlebar-drag h-12 flex items-center px-4 border-b border-border">
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
