import { Tabs, TabsList, TabsTrigger, TabsContent } from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, maxWidth: 440 }}>
      <Tabs defaultValue="gallery">
        <TabsList>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="help">Help</TabsTrigger>
        </TabsList>
        <TabsContent value="gallery" style={{ paddingTop: 16, color: 'var(--muted-foreground)', fontSize: 14, lineHeight: 1.6 }}>
          Browse all artworks and choose what plays. Free pieces are unlocked; the rest need a subscription.
        </TabsContent>
        <TabsContent value="account" style={{ paddingTop: 16 }}>Account settings.</TabsContent>
        <TabsContent value="help" style={{ paddingTop: 16 }}>Help & support.</TabsContent>
      </Tabs>
    </div>
  )
}
