import { useEffect, useRef, type KeyboardEvent } from 'react'
import { PaneCollapseButton } from '../kit/react/PaneLayout'
import type { Status } from '../kit/react/status'
import type { OrderEvent, WorkerLanguage } from '../types'
import { WORKFLOW_LANGUAGES, getLanguageDef, type CodeLine, type LanguageDef } from '../data/workflowCode'
import { orderStepStatus } from '../lib/stepStatus'

interface Props {
  events: OrderEvent[]
  finalStatus: string | null
  language: WorkerLanguage
  onLanguageChange: (language: WorkerLanguage) => void
}

function lineStatus(step: string, events: OrderEvent[]): Status | null {
  const status = orderStepStatus(step, events)
  return status === 'pending' ? null : status
}

function highlightSyntax(text: string, lang: LanguageDef): string {
  // Non-overlapping tokens, earlier rules win.
  const tokens: { start: number; end: number; className: string }[] = []

  for (const rule of lang.highlighting) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags)
    let match: RegExpExecArray | null
    while ((match = re.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length
      if (!tokens.some((t) => start < t.end && end > t.start)) {
        tokens.push({ start, end, className: rule.className })
      }
    }
  }

  tokens.sort((a, b) => a.start - b.start)

  let result = ''
  let cursor = 0
  for (const token of tokens) {
    result += escapeHtml(text.slice(cursor, token.start))
    result += `<span class="${token.className}">${escapeHtml(text.slice(token.start, token.end))}</span>`
    cursor = token.end
  }
  result += escapeHtml(text.slice(cursor))
  return result
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function TemporalCodeView({ events, finalStatus, language, onLanguageChange }: Props) {
  const lang = getLanguageDef(language)
  const allCode = [...lang.code, ...lang.compensation]
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const preRef = useRef<HTMLPreElement>(null)

  // Keep the live line on screen: the wait on the kitchen's Signal sits below the fold.
  useEffect(() => {
    preRef.current?.querySelector('.ln.hl')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [events.length, language])

  // One tab stop for the whole tablist; arrows, Home and End move between languages.
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const i = WORKFLOW_LANGUAGES.findIndex((l) => l.id === language)
    const last = WORKFLOW_LANGUAGES.length - 1
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: last }[event.key]
    if (to === undefined) return
    event.preventDefault()
    const j = (to + WORKFLOW_LANGUAGES.length) % WORKFLOW_LANGUAGES.length
    onLanguageChange(WORKFLOW_LANGUAGES[j].id)
    tabRefs.current[j]?.focus()
  }

  return (
    <section className="card" aria-label="Workflow code">
      <div className="card-head">
        <div>
          <p className="eyebrow">Workflow code · simplified excerpt</p>
          <h2 className="heading">The actual code</h2>
        </div>
        <PaneCollapseButton />
      </div>

      <div className="window flex-1 min-h-0">
        <div className="window-bar">
          <span className="window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="window-title">{lang.filename}</span>
        </div>
        <pre
          ref={preRef}
          className="codeview"
          id="workflow-code"
          role="tabpanel"
          tabIndex={0}
          aria-label={`${lang.filename}, abbreviated`}
        >
          {allCode.map((line, i) => (
            <CodeLineRow key={i} line={line} events={events} lang={lang} />
          ))}
        </pre>
        <div className="code-tabs" role="tablist" aria-label="SDK language" onKeyDown={onTabKey}>
          {WORKFLOW_LANGUAGES.map((l, i) => (
            <button
              key={l.id}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              type="button"
              role="tab"
              aria-selected={l.id === language}
              aria-controls="workflow-code"
              tabIndex={l.id === language ? 0 : -1}
              onClick={() => onLanguageChange(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <Callout events={events} finalStatus={finalStatus} lineCount={allCode.filter((line) => !line.isBlank).length} />
    </section>
  )
}

function Callout({
  events,
  finalStatus,
  lineCount,
}: {
  events: OrderEvent[]
  finalStatus: string | null
  lineCount: number
}) {
  if (events.length === 0) {
    return (
      <aside className="callout">
        <p className="eyebrow">Try it</p>
        <p>Place an order on the phone and watch each line light up as its step runs.</p>
      </aside>
    )
  }
  if (finalStatus === 'completed') {
    return (
      <aside className="callout" data-status="completed">
        <p className="eyebrow">That's the whole Workflow</p>
        <p>About {Math.round(lineCount / 10) * 10} lines. Retries, the kitchen's Signal and compensation are all built in.</p>
      </aside>
    )
  }
  if (finalStatus === 'failed' || finalStatus === 'refunded') {
    return (
      <aside className="callout">
        <p className="eyebrow">Compensation ran</p>
        <p>The Saga released the payment hold on its own. Nobody had to clean up by hand.</p>
      </aside>
    )
  }
  return (
    <aside className="callout">
      <p className="eyebrow">Behind every line</p>
      <p>No queues, no retry service, no dead letter queue, no cron jobs.</p>
    </aside>
  )
}

function CodeLineRow({
  line,
  events,
  lang,
}: {
  line: CodeLine
  events: OrderEvent[]
  lang: LanguageDef
}) {
  if (line.isBlank) {
    return <span className="ln blank" />
  }

  const status = line.step ? lineStatus(line.step, events) : null
  const classes = ['ln']
  if (status && status !== 'pending') classes.push(status === 'completed' ? 'done' : 'hl')

  const indent = '  '.repeat(line.indent)
  const html =
    line.isComment
      ? `<span class="c">${escapeHtml(line.text)}</span>`
      : line.isDecorator
        ? `<span class="k">${escapeHtml(line.text)}</span>`
        : highlightSyntax(line.text, lang)

  return (
    <span
      className={classes.join(' ')}
      data-status={status ?? undefined}
      dangerouslySetInnerHTML={{ __html: `${indent}${html}` }}
    />
  )
}
