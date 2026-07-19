import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { PlanPickerModal } from '../components/PlanPickerModal'
import { startCheckout } from './checkout'
import { track } from './analytics'

interface PlanPickerContextValue {
  /** Open the plan-picker modal. `source` names the CTA (for the PostHog funnel). */
  openPlanPicker: (source: string) => void
}

const PlanPickerContext = createContext<PlanPickerContextValue>({
  openPlanPicker: () => {},
})

// App-wide owner of the plan-picker modal. Every unlock CTA (upsell banner,
// gallery locks, fullscreen preview, tooltips) funnels through openPlanPicker
// so there's exactly one picker, rendered above whatever opened it; only the
// Account card's explicit per-plan buttons skip it and call startCheckout
// directly.
export function PlanPickerProvider({ children }: { children: ReactNode }) {
  // The source that opened the picker; null = closed.
  const [source, setSource] = useState<string | null>(null)

  const openPlanPicker = useCallback((src: string) => {
    track('plan_picker_opened', { source: src })
    setSource(src)
  }, [])

  return (
    <PlanPickerContext.Provider value={{ openPlanPicker }}>
      {children}
      {source && (
        <PlanPickerModal
          onCheckout={(plan) => {
            void startCheckout(source, plan)
            setSource(null)
          }}
          onClose={() => setSource(null)}
        />
      )}
    </PlanPickerContext.Provider>
  )
}

export function usePlanPicker(): PlanPickerContextValue {
  return useContext(PlanPickerContext)
}
