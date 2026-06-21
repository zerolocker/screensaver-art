import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  Button,
} from 'living-art-ui'

export function Destructive() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, minHeight: 380 }}>
      <AlertDialog defaultOpen>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">Clear cache</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the local gallery cache?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes every downloaded piece from this Mac. Your selection is kept and re-synced
              the next time the app runs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Clear cache</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
