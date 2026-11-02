import type { Status } from '../kit/react/status'
import type { StepStatus } from '../types'

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
