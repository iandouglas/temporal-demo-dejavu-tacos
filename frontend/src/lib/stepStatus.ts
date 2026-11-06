import type { Status } from '../kit/react/status'
import type { OrderEvent, StepStatus } from '../types'

/** An order step's state in the kit's status vocabulary. A running wait on the
 *  kitchen's Signal is held on a person, so it reads as waiting rather than running. */
export function stepStatus(stepKey: string, raw: StepStatus | undefined): Status {
  switch (raw) {
    case 'running':
      return stepKey === 'order_ready' ? 'waiting' : 'active'
    case 'retrying':
      return 'retrying'
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    default:
      return 'pending'
  }
}

/** A Temporal order's step state, from its events. The wait on the kitchen's Signal
 *  sends no event of its own: the Workflow is parked on it from the moment the store
 *  accepts the order until the Signal lands. Traditional mode has no such wait, because
 *  its handler returns once the store accepts. */
export function orderStepStatus(stepKey: string, events: OrderEvent[]): Status {
  const last = events.findLast((event) => event.step === stepKey)
  if (last) return stepStatus(stepKey, last.status)
  if (stepKey === 'order_ready' && orderStepStatus('submit_to_store', events) === 'completed') return 'waiting'
  return 'pending'
}
