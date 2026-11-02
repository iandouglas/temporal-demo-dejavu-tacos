import { useEffect, useRef } from 'react'
import { FAILURES, MODES, PRESENTATION, type Option } from '../data/scenarios'
import type { Settings } from '../types'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  settings: Settings
  onSave: (settings: Settings) => void
}

export function SettingsModal({ open, onClose, settings, onSave }: SettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // A native <dialog> gives focus trapping, Escape and the backdrop for free.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (settings[key] !== value) onSave({ ...settings, [key]: value })
  }

  return (
    <dialog
      ref={dialogRef}
      className="settings-dialog"
      aria-labelledby="settings-title"
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="card-head">
        <div>
          <p className="eyebrow">Presenter</p>
          <h2 id="settings-title" className="heading">Demo settings</h2>
        </div>
        <button
          type="button"
          className="button ghost slate icon small"
          aria-label="Close"
          title="Close"
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div className="settings-body">
        <Group label="Architecture" options={MODES} value={settings.mode} onChange={(v) => set('mode', v)} />
        <Group
          label="Failure scenario"
          options={FAILURES}
          value={settings.failure_scenario}
          onChange={(v) => set('failure_scenario', v)}
        />
        <Group
          label="Presentation"
          options={PRESENTATION}
          value={settings.presentation_mode}
          onChange={(v) => set('presentation_mode', v)}
        />
      </div>

      <p className="muted">Changing a setting starts a fresh order.</p>
    </dialog>
  )
}

function Group<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Option<V>[]
  value: V
  onChange: (value: V) => void
}) {
  return (
    <section className="settings-group" aria-label={label}>
      <p className="eyebrow">{label}</p>
      <div className="scenario-list" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className="scenario"
            data-status={o.status}
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            <span className="scenario-name">{o.name}</span>
            <span className="scenario-note">{o.note}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
