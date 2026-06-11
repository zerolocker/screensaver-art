// Renderer-side glue for the shared FeedbackForm. The form owns its own
// submitting/result state, so this is just the transport: fetch a fresh token
// (see getAccessToken) and hand the message + already-downsampled image to the
// main process, which attaches the diagnostics block and uploads it.

import type { ResizedImage } from '@screensaver-art/ui'
import { FEEDBACK_ENDPOINT } from './api'
import { getAccessToken } from './supabase'
import { log } from './log'

export function useFeedback() {
  async function submitFeedback(data: {
    message: string
    image: ResizedImage | null
  }): Promise<{ error?: string; id?: string }> {
    log.info('feedback', 'sending feedback', { hasImage: !!data.image })
    const accessToken = await getAccessToken()
    const result = await window.electronAPI.feedback.send({
      endpoint: FEEDBACK_ENDPOINT,
      accessToken,
      message: data.message,
      image: data.image,
    })
    if (!result.ok) return { error: result.error ?? 'Upload failed' }
    return { id: result.id }
  }

  return { submitFeedback }
}
