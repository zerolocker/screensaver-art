// Sends a debug report, with its own state per caller. Fetches a fresh token at
// send time (see getAccessToken).

import { useState } from 'react'
import { ERROR_REPORT_ENDPOINT } from './api'
import { getAccessToken } from './supabase'
import { log } from './log'

export interface ReportResult {
  ok: boolean
  id?: string
  error?: string
}

export function useErrorReport() {
  const [reporting, setReporting] = useState(false)
  const [reportResult, setReportResult] = useState<ReportResult | null>(null)

  async function sendReport(
    reason: string,
    errorText?: string | null,
    rendererContext?: unknown,
  ): Promise<ReportResult> {
    setReporting(true)
    setReportResult(null)
    log.info('report', 'sending error report', { reason })
    const accessToken = await getAccessToken()
    const result = await window.electronAPI.report.send({
      endpoint: ERROR_REPORT_ENDPOINT,
      accessToken,
      reason,
      error: errorText ?? undefined,
      rendererContext: rendererContext ?? null,
    })
    setReportResult(result)
    setReporting(false)
    return result
  }

  return { reporting, reportResult, sendReport }
}
