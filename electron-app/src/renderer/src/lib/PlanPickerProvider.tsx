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

// The one plan-picker modal, opened by every unlock button except the Account
// card's per-plan buttons, which call startCheckout directly.
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
