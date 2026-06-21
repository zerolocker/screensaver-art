import { FeedbackForm } from 'living-art-ui'

export function Default() {
  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', padding: 28, maxWidth: 440 }}>
      <FeedbackForm
        title="Send feedback"
        description="Tell us what's working and what isn't — it goes straight to the team."
        placeholder="I'd love a collection of Art Nouveau posters…"
        onSubmit={async () => ({ id: 'fb_123' })}
      />
    </div>
  )
}
