import { useEffect } from 'react'
import { toast } from 'sonner'
import { Toaster } from 'living-art-ui'

// Toaster is the mount point; fire toasts on mount so the card shows real
// notifications instead of an empty region.
export function Default() {
  useEffect(() => {
    toast('Gallery synced', { description: '3 new pieces added.' })
    toast.success('Living Art is now your screensaver')
  }, [])
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, minHeight: 220 }}>
      <Toaster position="top-center" />
      <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>
        Toaster mounts once; call <code>toast()</code> anywhere to push a notification.
      </p>
    </div>
  )
}
