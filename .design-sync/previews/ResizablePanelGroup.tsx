import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28 }}>
      <ResizablePanelGroup
        direction="horizontal"
        className="rounded-lg border"
        style={{ height: 240, width: 420 }}
      >
        <ResizablePanel defaultSize={35}>
          <div style={{ padding: 16, height: '100%', fontWeight: 600 }}>Collections</div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={65}>
          <div style={{ padding: 16, height: '100%', color: 'var(--muted-foreground)', fontSize: 14 }}>
            Select a collection to preview its pieces.
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
