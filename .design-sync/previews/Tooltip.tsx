import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Button } from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 40, minHeight: 200, display: 'flex', justifyContent: 'center' }}>
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger asChild>
            <Button variant="outline">Preview now</Button>
          </TooltipTrigger>
          <TooltipContent>Launch the screensaver immediately</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
