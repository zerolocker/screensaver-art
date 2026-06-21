import { useForm } from 'react-hook-form'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  Input,
  Button,
} from 'living-art-ui'

const frame: React.CSSProperties = {
  background: 'var(--background)',
  color: 'var(--foreground)',
  padding: 28,
  maxWidth: 400,
}

export function SignIn() {
  const form = useForm({ defaultValues: { email: 'you@example.com' } })
  return (
    <div style={frame}>
      <Form {...form}>
        <form style={{ display: 'grid', gap: 20 }} onSubmit={(e) => e.preventDefault()}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="you@example.com" {...field} />
                </FormControl>
                <FormDescription>We&apos;ll email you a one-time sign-in code.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">Send code</Button>
        </form>
      </Form>
    </div>
  )
}
