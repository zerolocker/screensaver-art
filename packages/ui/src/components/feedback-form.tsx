'use client'

import { useRef, useState } from 'react'
import { Loader2, ImagePlus, X } from 'lucide-react'
import { Button } from './button'
import { Textarea } from './textarea'
import { Label } from './label'
import { resizeImageToWebp, type ResizedImage } from '../image-resize'

export interface FeedbackFormProps {
  /**
   * Deliver the feedback. The image (if any) is already downsampled to webp.
   * Return `{ error }` to show an error, or `{ id }` to show a success reference.
   */
  onSubmit: (data: { message: string; image: ResizedImage | null }) => Promise<{ error?: string; id?: string }>
  /** Optional heading rendered above the form (hosts usually use a CardHeader instead). */
  title?: string
  /** Optional sub-heading rendered above the form. */
  description?: string
  /** Textarea placeholder. */
  placeholder?: string
}

interface SubmitResult {
  ok: boolean
  id?: string
  error?: string
}

function formatKb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function FeedbackForm({
  onSubmit,
  title,
  description,
  placeholder = 'Tell us what you think, or describe what went wrong…',
}: FeedbackFormProps) {
  const [message, setMessage] = useState('')
  const [image, setImage] = useState<ResizedImage | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function resetFileInput() {
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    resetFileInput()
    if (!file) return
    setImageError(null)
    setProcessing(true)
    try {
      const resized = await resizeImageToWebp(file)
      setImage(resized)
    } catch (err) {
      setImage(null)
      setImageError(err instanceof Error ? err.message : 'Could not process that image.')
    } finally {
      setProcessing(false)
    }
  }

  function removeImage() {
    setImage(null)
    setImageError(null)
    resetFileInput()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || submitting) return
    setSubmitting(true)
    setResult(null)
    const res = await onSubmit({ message: message.trim(), image })
    setSubmitting(false)
    if (res.error) {
      setResult({ ok: false, error: res.error })
      return
    }
    setResult({ ok: true, id: res.id })
    setMessage('')
    removeImage()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(title || description) && (
        <div className="space-y-1">
          {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="feedback-message">Your feedback</Label>
        <Textarea
          id="feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={placeholder}
          rows={5}
          className="bg-secondary border-border resize-none"
          disabled={submitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="feedback-image">Attach an image (optional)</Label>
        {image ? (
          <div className="flex items-center gap-3">
            <img
              src={image.dataUrl}
              alt="Attachment preview"
              className="h-16 w-16 rounded-md border border-border object-cover"
            />
            <span className="text-xs text-muted-foreground">
              {image.width}×{image.height}, {formatKb(image.bytes)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={removeImage}
              disabled={submitting}
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div>
            <input
              ref={fileInputRef}
              id="feedback-image"
              type="file"
              accept="image/*"
              onChange={handleFile}
              disabled={processing || submitting}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={processing || submitting}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <ImagePlus className="mr-2 h-4 w-4" /> Choose image
                </>
              )}
            </Button>
          </div>
        )}
        {imageError && <p className="text-xs text-red-500">{imageError}</p>}
      </div>

      <Button type="submit" disabled={submitting || processing || !message.trim()}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
          </>
        ) : (
          'Send feedback'
        )}
      </Button>

      {result?.ok && (
        <p className="text-xs text-green-500">
          Thanks for the feedback!{result.id && (
            <>
              {' '}Reference ID: <code className="font-mono">{result.id}</code>
            </>
          )}
        </p>
      )}
      {result && !result.ok && (
        <p className="text-xs text-red-500">Couldn’t send feedback: {result.error ?? 'unknown error'}</p>
      )}
    </form>
  )
}
