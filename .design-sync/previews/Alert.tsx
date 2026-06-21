import { Alert, AlertTitle, AlertDescription } from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, display: 'grid', gap: 16, maxWidth: 480 }}>
      <Alert>
        <AlertTitle>Living Art is your screensaver</AlertTitle>
        <AlertDescription>
          Starts after 5 min idle. You can change this in System Settings.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <AlertTitle>Couldn&apos;t register the screensaver</AlertTitle>
        <AlertDescription>
          Send an error report and restart the app to try again.
        </AlertDescription>
      </Alert>
    </div>
  )
}
