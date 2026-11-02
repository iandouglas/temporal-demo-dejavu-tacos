import { BackstagePanel as KitBackstagePanel } from '../kit/react/BackstagePanel'
import { StepList, type Step } from '../kit/react/StepList'
import { stepStatus } from '../lib/stepStatus'
import type { OrderEvent, Settings } from '../types'

interface BackstagePanelProps {
  events: OrderEvent[]
  settings: Settings
  finalStatus: string | null
  workflowId?: string | null
  temporalWorkflowUrl?: string | null
}

interface StepDef {
  key: string
  label: string
  service: string
}

const WORKFLOW_STEPS: StepDef[] = [
  { key: 'validate_order', label: 'Validate order', service: 'Cart service' },
  { key: 'validate_store', label: 'Validate store', service: 'Store service' },
  { key: 'authorize_payment', label: 'Authorize payment', service: 'Payment service' },
  { key: 'clear_cart', label: 'Clear cart', service: 'Cart service' },
  { key: 'submit_to_store', label: 'Submit to store', service: 'Store service' },
  { key: 'order_ready', label: 'Wait for order ready', service: 'Signal from the kitchen' },
  { key: 'capture_payment', label: 'Capture payment', service: 'Payment service' },
]

const COMPENSATION_STEPS: StepDef[] = [
  { key: 'release_payment_hold', label: 'Release payment hold', service: 'Payment service' },
  { key: 'notify_customer', label: 'Notify customer', service: 'Notification service' },
]

function lastEvent(stepKey: string, events: OrderEvent[]): OrderEvent | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].step === stepKey) return events[i]
  }
  return undefined
}

function toStep(def: StepDef, events: OrderEvent[], detailed: boolean): Step {
  const last = lastEvent(def.key, events)
  const status = stepStatus(def.key, last?.status)

  let note: string | undefined
  if (last && status === 'retrying') {
    note = `Retry ${last.attempt} of ${last.max_attempts}`
    if (detailed && last.error) note += ` · ${last.error}`
  } else if (detailed && last?.error) {
    note = last.error
  } else if (detailed && last && last.attempt > 1 && status === 'completed') {
    note = `Succeeded on attempt ${last.attempt}`
  }

  return {
    key: def.key,
    label: def.label,
    status,
    detail: detailed && last?.detail ? last.detail : def.service,
    note,
  }
}

export function BackstagePanel({
  events,
  settings,
  finalStatus,
  workflowId,
  temporalWorkflowUrl,
}: BackstagePanelProps) {
  const isDetailed = settings.presentation_mode === 'detailed'
  const isTemporal = settings.mode === 'temporal'

  const steps = events.length === 0 ? [] : WORKFLOW_STEPS.map((s) => toStep(s, events, isDetailed))
  const compensation = COMPENSATION_STEPS.filter((s) => lastEvent(s.key, events)).map((s) =>
    toStep(s, events, isDetailed),
  )

  const storeFailed =
    !isTemporal && stepStatus('submit_to_store', lastEvent('submit_to_store', events)?.status) === 'failed'

  return (
    <KitBackstagePanel
      steps={steps}
      title="Behind the scenes"
      subtitle={isTemporal ? 'Temporal Workflow' : 'Traditional · direct service calls'}
      empty="Place an order to see what happens behind the scenes."
      workflowId={isTemporal ? workflowId : null}
      executionUrl={temporalWorkflowUrl}
      banner={
        storeFailed ? (
          <div className="state-banner is-error">
            <strong>No automatic recovery</strong>
            The payment hold was placed but the store never received the order. The customer
            has been charged with no food on the way, and someone has to fix it by hand.
          </div>
        ) : null
      }
    >
      {compensation.length > 0 && (
        <>
          <div className="state-banner">
            <strong>Compensating</strong>
            The order can't finish, so the Saga undoes what already happened, newest first.
          </div>
          <StepList steps={compensation} className="compensation" />
        </>
      )}

      {finalStatus === 'completed' && (
        <aside className="callout" data-status="completed">
          <p className="eyebrow">Order complete</p>
          <p>Payment captured after the kitchen confirmed the order was ready.</p>
        </aside>
      )}
      {finalStatus === 'refunded' && (
        <aside className="callout">
          <p className="eyebrow">Compensation finished</p>
          <p>Payment hold released and the customer notified. Nobody was charged for food they won't get.</p>
        </aside>
      )}
      {finalStatus === 'failed' && !isTemporal && (
        <aside className="callout" data-status="failed">
          <p className="eyebrow">Order failed</p>
          <p>Manual intervention required.</p>
        </aside>
      )}
    </KitBackstagePanel>
  )
}
