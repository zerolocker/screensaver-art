// Base UI components
export { Button, buttonVariants } from './components/button'
export { Input } from './components/input'
export { Textarea } from './components/textarea'
export { Label } from './components/label'
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
} from './components/card'

// Shared auth components (passwordless: social + email one-time code)
export { OtpForm } from './components/otp-form'
export type { OtpFormProps } from './components/otp-form'
export { OAuthButtons } from './components/oauth-buttons'
export type { OAuthButtonsProps } from './components/oauth-buttons'
export {
  OAUTH_PROVIDERS,
  OAUTH_PROVIDER_LABELS,
  OAUTH_PROVIDER_OPTIONS,
} from './oauth'
export type { OAuthProvider } from './oauth'
export { SubscriptionCard } from './components/subscription-card'
export type { Subscription, SubscriptionCardProps } from './components/subscription-card'

// Feedback (shared by the Electron app + website)
export { FeedbackForm } from './components/feedback-form'
export type { FeedbackFormProps } from './components/feedback-form'
export { resizeImageToWebp } from './image-resize'
export type { ResizedImage, ResizeOptions } from './image-resize'

// Pricing
export { PRICING } from './pricing'

// Utilities
export { cn } from './utils'
