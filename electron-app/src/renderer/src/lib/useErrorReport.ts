// Shared hook for assembling + uploading a debug report. Used by the Help tab's
// "Send error report" button and by the inline button next to install errors on
// the Account page. Each caller gets its own reporting/result state.
//
// The access token is fetched fresh at send time (see getAccessToken) so the
// upload never fails with "Unauthorized" because of a stale token in React
// state.

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
