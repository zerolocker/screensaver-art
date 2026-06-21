import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldGroup,
  Input,
} from 'living-art-ui'

const frame: React.CSSProperties = {
  background: 'var(--background)',
  color: 'var(--foreground)',
  padding: 28,
  maxWidth: 400,
}

export function Default() {
  return (
    <div style={frame}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="acct-email">Email</FieldLabel>
          <Input id="acct-email" type="email" placeholder="you@example.com" />
          <FieldDescription>We&apos;ll send your one-time sign-in code here.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="acct-name">Display name</FieldLabel>
          <Input id="acct-name" defaultValue="Gavin" />
          <FieldDescription>Shown on your account page.</FieldDescription>
        </Field>
      </FieldGroup>
    </div>
  )
}
