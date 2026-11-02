import { useCallback, useEffect, useState } from 'react'
import { PaneCollapseButton } from '../kit/react/PaneLayout'
import type { OrderEvent } from '../types'

interface Props {
  events: OrderEvent[]
  finalStatus: string | null
}

const STAGES = [
  {
    title: '"Just direct HTTP calls!"',
    subtitle: 'The happy path. What could go wrong?',
  },
  {
    title: '"We need message queues"',
    subtitle: 'Services can\'t always respond immediately...',
  },
  {
    title: '"We need retry logic"',
    subtitle: 'What if the downstream service is temporarily down?',
  },
  {
    title: '"We need a dead letter queue"',
    subtitle: 'What happens to messages that keep failing?',
  },
  {
    title: '"We need state management"',
    subtitle: 'How do we track where each order is in the process?',
  },
  {
    title: '"We need monitoring & alerts"',
    subtitle: 'How do we know when things are broken?',
  },
  {
    title: '"We need compensation logic"',
    subtitle: 'How do we undo a payment if the store never got the order?',
  },
  {
    title: 'A Rube Goldberg machine.',
    subtitle: 'An engineering tax on every issue and every change, slowing down the business.',
  },
]

export function TraditionalArchDiagram(_props: Props) {
  const [stage, setStage] = useState(0)

  const next = useCallback(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), [])
  const prev = useCallback(() => setStage((s) => Math.max(s - 1, 0)), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable], dialog, [role="separator"], pre')) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); next() }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prev() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev])

  const s = stage

  const show = (minStage: number) =>
    s >= minStage ? 'opacity-100 transition-all duration-500' : 'opacity-0 pointer-events-none transition-all duration-300'

  // Grid coordinates for clean alignment
  // Center column: x=260, Left: x=130, Right: x=390
  const CX = 260 // center x
  const RX = 380 // right column

  return (
    <section className="card" aria-label="Traditional architecture">
      <div className="card-head">
        <div>
          <p className="eyebrow">Traditional architecture · {s + 1} of {STAGES.length}</p>
          <h2 className="heading">{STAGES[s].title}</h2>
          <p className="muted mt-1">{STAGES[s].subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-none">
          <button type="button" className="button secondary ultraviolet icon small" onClick={prev} disabled={s === 0} aria-label="Previous stage" title="Previous stage (←)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <button type="button" className="button secondary ultraviolet icon small" onClick={next} disabled={s === STAGES.length - 1} aria-label="Next stage" title="Next stage (→)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <PaneCollapseButton />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto flex items-start justify-center">
        <svg viewBox="0 0 520 540" className="arch-svg w-full max-w-[520px]" xmlns="http://www.w3.org/2000/svg">

          {/* ═══ STAGE 0: Happy path ═══ */}
          {/* Diamond centers: Payment at (180, 210), Store at (380, 210) */}
          <g className={show(0)}>
            {/* API Gateway */}
            <rect x={CX-70} y="15" width="140" height="40" rx="8" className="fill-t-green/15 stroke-t-green" strokeWidth="1.5" />
            <text x={CX} y="40" textAnchor="middle" className="text-[13px] font-bold fill-t-green">API Gateway</text>

            {/* Arrow: API → Order */}
            <line x1={CX} y1="55" x2={CX} y2="80" className="stroke-t-green/60" strokeWidth="1.5" />
            <polygon points={`${CX},85 ${CX-5},77 ${CX+5},77`} className="fill-t-green/60" />

            {/* Order Service */}
            <rect x={CX-90} y="85" width="180" height="44" rx="8" className="fill-t-green/20 stroke-t-green" strokeWidth="2" />
            <text x={CX} y="112" textAnchor="middle" className="text-[13px] font-bold fill-t-green">Order Service</text>

            {/* Arrow: Order → Payment diamond top (220, 185) */}
            <line x1={CX-30} y1="129" x2="220" y2="180" className="stroke-t-green/60" strokeWidth="1.5" strokeDasharray="5 3" />
            <polygon points="220,185 215,175 225,175" className="fill-t-green/60" />

            {/* Arrow: Order → Store diamond top (380, 185) */}
            <line x1={CX+30} y1="129" x2="380" y2="180" className="stroke-t-green/60" strokeWidth="1.5" strokeDasharray="5 3" />
            <polygon points="380,185 375,175 385,175" className="fill-t-green/60" />

            {/* Payment diamond — center (180, 210) */}
            <polygon points="180,210 220,185 260,210 220,235" className="fill-t-green/15 stroke-t-green" strokeWidth="1.5" />
            <text x="220" y="214" textAnchor="middle" className="text-[11px] font-semibold fill-t-green">Payment</text>

            {/* Store diamond — center (380, 210) */}
            <polygon points="340,210 380,185 420,210 380,235" className="fill-t-green/15 stroke-t-green" strokeWidth="1.5" />
            <text x="380" y="214" textAnchor="middle" className="text-[11px] font-semibold fill-t-green">Store</text>
          </g>

          {/* ═══ STAGE 1: Message Queues ═══ */}
          <g className={show(1)}>
            {/* Payment Queue — below Payment diamond (center 220) */}
            <line x1="220" y1="235" x2="220" y2="260" className="stroke-t-cyan/50" strokeWidth="1" strokeDasharray="4 3" />
            <rect x="180" y="260" width="80" height="28" rx="4" className="fill-t-cyan/15 stroke-t-cyan" strokeWidth="1.5" />
            {[0,1,2].map(i => (
              <line key={`pq${i}`} x1={198+i*20} y1="265" x2={198+i*20} y2="283" className="stroke-t-cyan/50" strokeWidth="1.5" />
            ))}
            <text x="220" y="300" textAnchor="middle" className="text-[9px] fill-t-cyan">payment queue</text>

            {/* Store Queue — below Store diamond (center 380) */}
            <line x1="380" y1="235" x2="380" y2="260" className="stroke-t-cyan/50" strokeWidth="1" strokeDasharray="4 3" />
            <rect x="340" y="260" width="80" height="28" rx="4" className="fill-t-cyan/15 stroke-t-cyan" strokeWidth="1.5" />
            {[0,1,2].map(i => (
              <line key={`sq${i}`} x1={358+i*20} y1="265" x2={358+i*20} y2="283" className="stroke-t-cyan/50" strokeWidth="1.5" />
            ))}
            <text x="380" y="300" textAnchor="middle" className="text-[9px] fill-t-cyan">store queue</text>
          </g>

          {/* ═══ STAGE 2: Retry Logic ═══ */}
          <g className={show(2)}>
            <rect x="440" y="260" width="70" height="28" rx="6" className="fill-t-yellow/15 stroke-t-yellow" strokeWidth="1.5" />
            <text x="475" y="278" textAnchor="middle" className="text-[9px] font-semibold fill-t-yellow">Retry Svc</text>

            {/* Arrow: Store queue → Retry */}
            <line x1="420" y1="274" x2="440" y2="274" className="stroke-t-yellow/50" strokeWidth="1" strokeDasharray="4 3" />

            {/* Curved arrow: Retry → back to Store diamond */}
            <path d="M 475 260 C 475 240, 420 235, 420 210" fill="none" className="stroke-t-yellow/40" strokeWidth="1" strokeDasharray="3 3" />
            <polygon points="420,210 416,218 424,218" className="fill-t-yellow/40" />

            {/* Timer */}
            <circle cx="480" cy="305" r="12" className="fill-space-black/60 stroke-t-yellow/50" strokeWidth="1" />
            <text x="480" y="309" textAnchor="middle" className="text-[8px] fill-t-yellow/70">timer</text>
            <line x1="475" y1="288" x2="475" y2="293" className="stroke-t-yellow/40" strokeWidth="1" />
          </g>

          {/* ═══ STAGE 3: Dead Letter Queue ═══ */}
          <g className={show(3)}>
            <line x1="380" y1="288" x2="380" y2="320" className="stroke-t-pink/40" strokeWidth="1" strokeDasharray="4 3" />
            <rect x="330" y="320" width="100" height="28" rx="4" className="fill-t-pink/15 stroke-t-pink" strokeWidth="1.5" />
            {[0,1,2,3].map(i => (
              <line key={`dl${i}`} x1={348+i*20} y1="325" x2={348+i*20} y2="343" className="stroke-t-pink/50" strokeWidth="1.5" />
            ))}
            <text x="380" y="360" textAnchor="middle" className="text-[9px] fill-t-pink">dead letter queue</text>
          </g>

          {/* ═══ STAGE 4: State Management ═══ */}
          <g className={show(4)}>
            {/* State DB — left of Order Service */}
            <ellipse cx="60" cy="100" rx="32" ry="11" className="fill-t-purple/10 stroke-t-purple/70" strokeWidth="1.5" />
            <rect x="28" y="100" width="64" height="20" className="fill-t-purple/10 stroke-t-purple/70" strokeWidth="1.5" />
            <ellipse cx="60" cy="120" rx="32" ry="11" className="fill-t-purple/10 stroke-t-purple/70" strokeWidth="1.5" />
            <text x="60" y="114" textAnchor="middle" className="text-[10px] font-semibold fill-t-purple">State DB</text>
            <line x1="92" y1="107" x2={CX-90} y2="107" className="stroke-t-purple/40" strokeWidth="1" strokeDasharray="4 3" />

            {/* Cron */}
            <circle cx="60" cy="210" r="20" className="fill-t-purple/10 stroke-t-purple/50" strokeWidth="1" />
            <text x="60" y="208" textAnchor="middle" className="text-[9px] fill-t-purple">cron</text>
            <text x="60" y="219" textAnchor="middle" className="text-[7px] fill-t-purple/60">cleanup</text>
            <line x1="80" y1="210" x2="180" y2="210" className="stroke-t-purple/30" strokeWidth="1" strokeDasharray="3 3" />
          </g>

          {/* ═══ STAGE 5: Monitoring ═══ */}
          <g className={show(5)}>
            <rect x="20" y="320" width="120" height="32" rx="6" className="fill-t-indigo/15 stroke-t-indigo" strokeWidth="1.5" />
            <text x="80" y="340" textAnchor="middle" className="text-[10px] font-semibold fill-t-indigo">Alert / PagerDuty</text>

            <line x1="80" y1="352" x2="80" y2="375" className="stroke-t-indigo/30" strokeWidth="1" strokeDasharray="3 3" />

            <rect x="20" y="375" width="120" height="28" rx="6" className="fill-t-indigo/10 stroke-t-indigo/50" strokeWidth="1" />
            <text x="80" y="393" textAnchor="middle" className="text-[9px] fill-t-indigo/70">Log Aggregator</text>
            <text x="80" y="414" textAnchor="middle" className="text-[8px] fill-t-slate">correlate across services</text>
          </g>

          {/* ═══ STAGE 6: Compensation ═══ */}
          <g className={show(6)}>
            <rect x={CX-75} y="380" width="150" height="32" rx="6" className="fill-t-pink/15 stroke-t-pink/70" strokeWidth="1.5" />
            <text x={CX} y="400" textAnchor="middle" className="text-[10px] font-semibold fill-t-pink">Compensation Service</text>
            <text x={CX} y="424" textAnchor="middle" className="text-[8px] fill-t-slate">refund, rollback, reconciliation</text>

            <rect x={RX-30} y="380" width="110" height="32" rx="6" className="fill-t-pink/10 stroke-t-pink/40" strokeWidth="1" />
            <text x={RX+25} y="400" textAnchor="middle" className="text-[9px] fill-t-pink/70">Feature Flags</text>
            <text x={RX+25} y="424" textAnchor="middle" className="text-[8px] fill-t-slate">circuit breakers</text>
          </g>

          {/* ═══ STAGE 7: Punchline ═══ */}
          <g className={show(7)}>
            <rect x="50" y="460" width="420" height="58" rx="10" className="fill-t-pink/8 stroke-t-pink/30" strokeWidth="1" />
            <text x={CX} y="483" textAnchor="middle" className="text-[11px] fill-t-slate">
              8 services · 3 queues · 2 databases · cron · timers · feature flags
            </text>
            <text x={CX} y="500" textAnchor="middle" className="text-[11px] fill-t-pink font-semibold">
              A Rube Goldberg machine — an engineering tax on every change.
            </text>
          </g>

        </svg>
      </div>

      <div className="arch-dots" role="group" aria-label="Stages">
        {STAGES.map((st, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setStage(i)}
            className={i < stage ? 'seen' : undefined}
            aria-current={i === stage ? 'step' : undefined}
            aria-label={`Stage ${i + 1}: ${st.title}`}
            title={st.title}
          />
        ))}
      </div>
      <p className="muted text-center m-0">Use <kbd>←</kbd> <kbd>→</kbd> to step through</p>
    </section>
  )
}
