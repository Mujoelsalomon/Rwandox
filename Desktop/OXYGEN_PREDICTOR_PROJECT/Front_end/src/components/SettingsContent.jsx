import React, { useState } from 'react'

const preferenceItems = [
  { label: 'Topbar notifications', detail: 'Show clinical and model alerts in the notification bell.' },
  { label: 'High-risk sound cue', detail: 'Play a short cue when a high-risk prediction is created.' },
  { label: 'Auto-refresh dashboard', detail: 'Refresh patient summaries and model metrics during active sessions.' },
]

const thresholds = [
  { label: 'Low risk', value: '0-39%', tone: 'green' },
  { label: 'Moderate risk', value: '40-69%', tone: 'amber' },
  { label: 'High risk', value: '70-100%', tone: 'red' },
]

export default function SettingsContent() {
  const [enabled, setEnabled] = useState({
    'Topbar notifications': true,
    'High-risk sound cue': true,
    'Auto-refresh dashboard': false,
  })

  function toggle(label) {
    setEnabled((current) => ({ ...current, [label]: !current[label] }))
  }

  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-[16px] border border-[#e2eaf5] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.07)] md:px-6">
        <p className="text-[13px] font-black uppercase tracking-[0.22em] text-[#1768f2]">System settings</p>
        <div className="mt-2">
          <div className="min-w-0">
            <h1 className="break-words text-[30px] font-black leading-[34px] text-[#071b49]">
              Clinical workspace settings
            </h1>
            <p className="mt-2 max-w-[760px] text-[16px] leading-7 text-[#53668a]">
              Configure notification behavior, risk thresholds, model preferences, and account details for the oxygen prediction workflow.
            </p>
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
        <div className="min-w-0 rounded-[16px] border border-[#e2eaf5] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.07)] md:px-6">
          <h2 className="text-[22px] font-black text-[#071b49]">Notification preferences</h2>
          <div className="mt-4 space-y-3">
            {preferenceItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => toggle(item.label)}
                className="flex w-full min-w-0 items-center justify-between gap-4 rounded-[12px] border border-[#d9e5f3] bg-[#f8fbff] px-4 py-4 text-left transition hover:border-[#b8cce6]"
              >
                <span className="min-w-0">
                  <span className="block break-words text-[16px] font-extrabold text-[#071b49]">{item.label}</span>
                  <span className="mt-1 block break-words text-[14px] leading-5 text-[#53668a]">{item.detail}</span>
                </span>
                <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled[item.label] ? 'bg-[#1768f2]' : 'bg-[#cbd5e1]'}`}>
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${enabled[item.label] ? 'left-6' : 'left-1'}`} />
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-[16px] border border-[#e2eaf5] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.07)] md:px-6">
          <h2 className="text-[22px] font-black text-[#071b49]">Risk thresholds</h2>
          <div className="mt-4 space-y-3">
            {thresholds.map((item) => (
              <div key={item.label} className="flex min-w-0 items-center justify-between gap-4 rounded-[12px] bg-[#f8fbff] px-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-extrabold text-[#071b49]">{item.label}</p>
                  <p className="text-[14px] text-[#53668a]">{item.value}</p>
                </div>
                <span className={`h-3 w-3 shrink-0 rounded-full ${dotClass(item.tone)}`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-5 lg:grid-cols-2">
        <SettingsPanel title="Model defaults">
          <Field label="Default model" value="XGBoost postoperative oxygen model" />
          <Field label="Validation metric" value="AUC with calibration review" />
          <Field label="Decision support mode" value="Clinical review required before action" />
        </SettingsPanel>

        <SettingsPanel title="Account and hospital">
          <Field label="Role" value="Anesthetist - Clinician" />
          <Field label="Facility" value="Kibagabaga Level Two Teaching Hospital" />
          <Field label="Workspace" value="Post-op Oxygen Requirement Prediction" />
        </SettingsPanel>
      </section>

      <div className="flex justify-end">
        <button className="min-h-12 w-full rounded-full bg-[#111b3b] px-6 py-3 text-center text-[15px] font-extrabold leading-5 text-white shadow-[0_10px_24px_rgba(17,27,59,0.22)] transition hover:bg-[#172653] sm:w-auto sm:min-w-[170px]">
          Save changes
        </button>
      </div>
    </div>
  )
}

function SettingsPanel({ title, children }) {
  return (
    <div className="min-w-0 rounded-[16px] border border-[#e2eaf5] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.07)] md:px-6">
      <h2 className="text-[22px] font-black text-[#071b49]">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="min-w-0 rounded-[12px] border border-[#d9e5f3] bg-[#f8fbff] px-4 py-3">
      <p className="text-[13px] font-bold text-[#6c7f9f]">{label}</p>
      <p className="mt-1 break-words text-[15px] font-extrabold text-[#071b49]">{value}</p>
    </div>
  )
}

function dotClass(tone) {
  if (tone === 'red') return 'bg-[#ef4444]'
  if (tone === 'amber') return 'bg-[#f59e0b]'
  return 'bg-[#22c55e]'
}
