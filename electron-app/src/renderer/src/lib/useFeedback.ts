// Sends FeedbackForm's message and image to the main process, which adds
// diagnostics and uploads them.

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
