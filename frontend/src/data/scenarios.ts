// The demo's paths: which architecture runs the order and what goes wrong. Shared by
// the settings dialog and the path button in the top bar, so both use the same names.
import type { Settings } from '../types'

export interface Option<V extends string> {
  value: V
  name: string
  /** Short form for the path button in the top bar. */
  short?: string
  note: string
  /** Colours the option by what it does to the Workflow (status vocabulary). */
  status?: string
}

export const MODES: Option<Settings['mode']>[] = [
  { value: 'traditional', name: 'Traditional (direct calls)', short: 'Traditional', note: 'Sequential service calls with no retries or compensation.' },
  { value: 'temporal', name: 'Temporal', note: 'A durable Workflow with retries, a Signal and compensation.' },
]

export const FAILURES: Option<Settings['failure_scenario']>[] = [
  { value: 'none', name: 'None (happy path)', short: 'Happy path', note: 'Every step succeeds first time.', status: 'completed' },
  { value: 'store_connectivity', name: 'Store connectivity', note: 'The store loses its connection mid-order. The default.', status: 'retrying' },
  { value: 'payment_error', name: 'Payment service error', short: 'Payment error', note: 'The payment gateway times out.', status: 'retrying' },
  { value: 'random_chaos', name: 'Random chaos', note: '30% chance of a failure at any step.', status: 'retrying' },
]

export const PRESENTATION: Option<Settings['presentation_mode']>[] = [
  { value: 'simple', name: 'Simple', note: 'Step status only.' },
  { value: 'detailed', name: 'Detailed', note: 'Retries, error messages and step details.' },
]

/** "Temporal · Store connectivity": the path the demo is on, for the top bar. */
export function pathLabel(settings: Settings): string {
  const short = (o?: Option<string>) => o?.short ?? o?.name ?? ''
  const mode = MODES.find((m) => m.value === settings.mode)
  const failure = FAILURES.find((f) => f.value === settings.failure_scenario)
  return `${short(mode)} · ${short(failure)}`
}
