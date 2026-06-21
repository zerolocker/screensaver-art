import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, maxWidth: 460 }}>
      <Accordion type="single" collapsible defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger>How much does it cost?</AccordionTrigger>
          <AccordionContent>
            $0.99/month, billed quarterly as $2.97. Fifty pieces are free forever.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Does it work offline?</AccordionTrigger>
          <AccordionContent>
            Yes — once synced, the screensaver plays from the local cache with no network.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger>How do I set it as my screensaver?</AccordionTrigger>
          <AccordionContent>
            Click “Set” in the app, or choose Living Art in System Settings → Screen Saver.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
