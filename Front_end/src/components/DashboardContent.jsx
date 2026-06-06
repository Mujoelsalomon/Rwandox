import React, { useEffect, useState } from 'react'

import { API_BASE_URL } from '../config/api.js'
import { PREDICTION_HISTORY_UPDATED_EVENT } from '../predictionEvents'

function dashboardMetrics(activeModel) {
  const modelMetrics = activeModel?.metrics || {}
  const aucValue = formatModelMetric(modelMetrics.val_auc ?? modelMetrics.auc, '0.84')
  const f1Value = formatModelMetric(modelMetrics.val_f1_score ?? modelMetrics.f1_score, '0.81')

  return [
  {
    label: 'Predictions Today',
    value: '24',
    sub: '4 high-risk cases',
    chip: '14%',
    chipTone: 'blue',
    icon: 'trendUp',
    iconTone: 'blue',
  },
  {
    label: 'Average Risk Score',
    value: '41%',
    sub: 'Across all assessed patients',
    chip: '5%',
    chipTone: 'green',
    icon: 'users',
    iconTone: 'green',
  },
  {
    label: 'High-Risk Alerts',
    value: '6',
    sub: 'Require close oxygen review',
    chip: 'Critical',
    chipTone: 'orange',
    icon: 'warning',
    iconTone: 'orange',
  },
  {
    label: 'Model AUC',
    value: aucValue,
    sub: 'Latest validated version',
    chip: 'Excellent',
    chipTone: 'purple',
    icon: 'shield',
    iconTone: 'purple',
  },
  {
    label: 'Model F1-score',
    value: f1Value,
    sub: 'Balance of precision and recall',
    chip: 'Strong',
    chipTone: 'teal',
    icon: 'checkCircle',
    iconTone: 'teal',
  },
  ]
}

const workflowSteps = [
  { title: 'Patient Assessment', sub: 'Enter patient clinical data', tone: 'blue', icon: 'user' },
  { title: 'Risk Prediction', sub: 'AI model calculates risk', tone: 'green', icon: 'brain' },
  { title: 'Review Results', sub: 'Check risk level and alerts', tone: 'orange', icon: 'warning' },
  { title: 'Clinical Decision', sub: 'Plan oxygen management', tone: 'purple', icon: 'clipboard' },
]

const riskRows = [
  { label: 'High Risk', value: '6 (25%)', color: '#fb2d2d' },
  { label: 'Medium Risk', value: '10 (42%)', color: '#ff9f12' },
  { label: 'Low Risk', value: '8 (33%)', color: '#31b966' },
]

const recentPredictionsPageSize = 10

export default function DashboardContent({
  activeModel,
  factorChips = [],
  handleGenerate,
  loading,
  probability,
  riskLabel = 'High',
}) {
  const riskScore = Math.round(probability * 100)
  const metrics = dashboardMetrics(activeModel)

  return (
    <div className="container-fluid min-w-0 space-y-4 px-0 pb-4">
      <HeroCard />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
        <RiskDistribution />
        <RiskTrend riskScore={riskScore} />
      </section>

      <WorkflowPanel />

      <AssessmentPredictionPanel
        factorChips={factorChips}
        handleGenerate={handleGenerate}
        loading={loading}
        riskLabel={riskLabel}
        riskScore={riskScore}
      />
    </div>
  )
}

function HeroCard() {
  return (
    <section className="card shadow-sm rounded-4 mb-3 mx-auto max-w-[720px] rounded-[14px] border border-[#bfdbfe] bg-white px-4 py-3 text-center md:px-5 md:py-4">
      <h1 className="page-title fw-black mb-0 font-black text-[#071b49]">
        Postoperative Oxygen Requirement Prediction
      </h1>
    </section>
  )
}

function MetricCard({ label, value, sub, chip, chipTone, icon, iconTone }) {
  return (
    <article className="card shadow-sm rounded-4 min-w-0 rounded-[14px] border border-[#cbd8e8] bg-white px-4 py-4">
      <div className="flex gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] ${toneClass(iconTone, 'iconSoft')}`}>
          <Icon name={icon} className={`h-6 w-6 ${toneClass(iconTone, 'text')}`} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="card-title font-extrabold text-[#071b49]">{label}</h2>
          <p className="mt-2 text-[32px] font-black leading-none text-[#071b49]">{value}</p>
          <p className="small-text mt-2 font-semibold text-[#334766]">{sub}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 pl-16">
        <span className={`badge rounded-pill rounded-[7px] px-2.5 py-1 text-[12px] font-extrabold ${toneClass(chipTone, 'chip')}`}>
          {chipTone === 'green' && <span className="mr-1">↓</span>}
          {chipTone === 'blue' && <span className="mr-1">↑</span>}
          {chip}
        </span>
        {(chipTone === 'blue' || chipTone === 'green') && (
          <span className="text-[12px] font-black text-[#334766]">vs yesterday</span>
        )}
      </div>
    </article>
  )
}

function RiskDistribution() {
  return (
    <section className="card shadow-sm rounded-4 mb-3 min-w-0 overflow-hidden rounded-[16px] border border-[#cbd8e8] bg-white px-5 py-5 md:px-6">
      <h2 className="section-title h4 fw-bold font-black text-[#071b49]">Risk Distribution</h2>
      <div className="mt-3 flex flex-col items-center gap-8 md:flex-row md:justify-center">
        <div className="relative flex h-[170px] w-[170px] shrink-0 items-center justify-center rounded-full bg-[conic-gradient(#fb2d2d_0_25%,#ff9f12_25%_67%,#31b966_67%_100%)]">
          <div className="flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full bg-white shadow-inner">
            <span className="text-[28px] font-black leading-none text-[#071b49]">24</span>
            <span className="text-[14px] text-[#53668a]">Total</span>
          </div>
        </div>

        <div className="w-full max-w-[340px] space-y-5">
          {riskRows.map((row) => (
            <div key={row.label} className="grid grid-cols-[16px_1fr_auto] items-center gap-3 text-[16px]">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.color }} />
              <span className="font-semibold text-[#334766]">{row.label}</span>
              <span className="font-medium text-[#20365f]">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function RiskTrend({ riskScore }) {
  const points = [
    [8, 50],
    [22, 36],
    [37, 56],
    [52, 68],
    [67, 54],
    [82, 63],
    [94, 54],
  ]

  return (
    <section className="card shadow-sm rounded-4 mb-3 min-w-0 overflow-hidden rounded-[16px] border border-[#cbd8e8] bg-white px-5 py-5 md:px-6">
      <h2 className="section-title h4 fw-bold font-black text-[#071b49]">Risk Trend (Last 7 Days)</h2>
      <div className="relative mt-3 h-[175px]">
        <div className="absolute inset-x-0 top-2 h-px bg-[#dfe7f2]" />
        <div className="absolute inset-x-0 top-[46px] h-px bg-[#dfe7f2]" />
        <div className="absolute inset-x-0 top-[90px] h-px bg-[#dfe7f2]" />
        <div className="absolute inset-x-0 top-[132px] h-px bg-[#dfe7f2]" />
        <div className="absolute left-0 top-0 flex h-[150px] flex-col justify-between text-[14px] font-semibold text-[#334766]">
          <span>80%</span>
          <span>60%</span>
          <span>40%</span>
          <span>20%</span>
          <span>0%</span>
        </div>

        <svg className="absolute left-12 right-3 top-0 h-[148px] w-[calc(100%-3.75rem)] overflow-visible" viewBox="0 0 100 80" preserveAspectRatio="none">
          <defs>
            <linearGradient id="riskFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#1c64f2" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#1c64f2" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d="M8 50 L22 36 L37 56 L52 68 L67 54 L82 63 L94 54 L94 80 L8 80 Z" fill="url(#riskFill)" />
          <polyline points={points.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="#1768f2" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
          {points.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.9" fill="#1768f2" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <div className="absolute right-0 top-[32px] rounded-[6px] bg-[#1768f2] px-3 py-2 text-[14px] font-extrabold text-white">
          {riskScore}%
        </div>
        <div className="absolute bottom-0 left-12 right-3 grid grid-cols-7 text-center text-[11px] font-semibold text-[#334766] sm:text-[14px]">
          <span>May 6</span>
          <span>May 7</span>
          <span>May 8</span>
          <span>May 9</span>
          <span>May 10</span>
          <span>May 11</span>
          <span>May 12</span>
        </div>
      </div>
    </section>
  )
}

function WorkflowPanel() {
  return (
    <section className="card shadow-sm rounded-4 mb-3 min-w-0 overflow-hidden rounded-[16px] border border-[#cbd8e8] bg-white px-5 py-4 md:px-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="section-title font-black text-[#071b49]">System workflow</h2>
          <p className="small-text font-semibold text-[#334766]">Assess and manage patient risk</p>
        </div>
      </div>
      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {workflowSteps.map((step, index) => (
          <React.Fragment key={step.title}>
            <WorkflowStep index={index + 1} {...step} />
          </React.Fragment>
        ))}
      </div>
    </section>
  )
}

function WorkflowStep({ index, title, sub, tone, icon }) {
  return (
    <div className={`card flex min-h-[58px] min-w-0 items-center gap-3 rounded-[10px] border px-3 py-2 ${toneClass(tone, 'panel')}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[18px] font-black ${toneClass(tone, 'stepNumber')}`}>
        {index}
      </div>
      <Icon name={icon} className={`h-6 w-6 shrink-0 ${toneClass(tone, 'text')}`} />
      <div className="min-w-0">
        <p className="break-words text-[14px] font-extrabold leading-5 text-[#071b49]">{title}</p>
        <p className="break-words text-[12px] font-semibold leading-4 text-[#334766]">{sub}</p>
      </div>
    </div>
  )
}

function AssessmentPredictionPanel({ factorChips, handleGenerate, loading, riskLabel, riskScore }) {
  const riskTone = getRiskTone(riskLabel)

  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.75fr)]">
      <RecentPredictionsTable />

      <div className="min-w-0 space-y-5">
        <section className="card shadow rounded-4 rounded-[20px] border border-[#cbd8e8] bg-white px-6 py-6 text-[#071b49]">
          <div className="flex items-start justify-between gap-4">
            <h2 className="section-title max-w-[170px] font-black tracking-wide">
              Current prediction
            </h2>
            <RiskStatusCard risk={riskLabel} />
          </div>
          <p className={`prediction-value mt-7 ${riskTone.text}`}>{riskScore}%</p>
          <p className="body-text mt-5 max-w-[340px] font-extrabold text-[#20365f]">
            Probability of postoperative oxygen requirement. This patient is likely to require supplemental oxygen during the immediate postoperative period.
          </p>
        </section>

        <section className="card shadow-sm rounded-4 rounded-[20px] border border-[#cbd8e8] bg-white px-5 py-5">
          <h2 className="section-title font-black text-[#071b49]">
            Key contributing factors
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {factorChips.map((chip) => (
              <span
                key={chip}
                className="risk-badge-text badge rounded-pill border border-[#fecaca] bg-[#dc2626] px-3 py-2 font-extrabold text-white shadow-sm"
              >
                {chip}
              </span>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function RecentPredictionsTable() {
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let active = true

    async function loadRecentPredictions({ showLoading = false } = {}) {
      if (showLoading) setLoading(true)
      try {
        const resp = await fetch(`${API_BASE_URL}/prediction-history`, { credentials: 'include' })
        const data = await resp.json()
        if (!active) return
        if (!resp.ok) throw new Error(data.error || 'Could not load recent predictions.')
        setPredictions(sortPredictionsByDate(data.predictions || []))
        setPage(1)
        setStatus('')
      } catch (error) {
        console.error(error)
        if (active) {
          setPredictions([])
          setStatus('Could not load recent predictions from the backend.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadRecentPredictions()
    function handlePredictionHistoryUpdated() {
      loadRecentPredictions({ showLoading: true })
    }

    window.addEventListener(PREDICTION_HISTORY_UPDATED_EVENT, handlePredictionHistoryUpdated)
    return () => {
      active = false
      window.removeEventListener(PREDICTION_HISTORY_UPDATED_EVENT, handlePredictionHistoryUpdated)
    }
  }, [])

  const totalPages = Math.max(1, Math.ceil(predictions.length / recentPredictionsPageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * recentPredictionsPageSize
  const visiblePredictions = predictions.slice(startIndex, startIndex + recentPredictionsPageSize)
  const showingStart = predictions.length === 0 ? 0 : startIndex + 1
  const showingEnd = Math.min(startIndex + recentPredictionsPageSize, predictions.length)

  return (
    <section className="card shadow-sm rounded-4 mb-3 min-w-0 overflow-hidden rounded-[16px] border border-[#cbd8e8] bg-white">
      <div className="flex flex-col gap-2 border-b border-[#cbd8e8] px-5 py-5 md:flex-row md:items-end md:justify-between md:px-6">
        <div>
            <h2 className="section-title font-black text-[#071b49]">
            Recent predictions
          </h2>
          <p className="small-text mt-1 font-semibold text-[#334766]">
            Latest generated postoperative oxygen risk results.
          </p>
        </div>
        <span className="risk-badge-text badge rounded-pill w-fit bg-[#1768f2] px-3 py-2 font-extrabold uppercase tracking-[0.08em] text-white">
          Latest {showingStart}-{showingEnd} of {predictions.length || 0}
        </span>
      </div>

      {status && (
        <div className="alert alert-warning rounded-4 mx-5 mt-4 border border-[#f59e0b] bg-[#fffbeb] px-4 py-3 text-[13px] font-bold text-[#713f12] md:mx-6">
          {status}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table table-hover align-middle mb-0 min-w-[760px] w-full text-left">
          <thead>
            <tr className="table-header border-b border-[#cbd8e8] bg-[#eaf2ff] font-black uppercase tracking-[0.08em] text-[#071b49]">
              <th className="px-5 py-3">Generated</th>
              <th className="px-5 py-3">Patient ID</th>
              <th className="px-5 py-3">Surgery</th>
              <th className="px-5 py-3">Disposition</th>
              <th className="px-5 py-3">Risk</th>
              <th className="px-5 py-3">Probability</th>
              <th className="px-5 py-3">Model</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-5 py-5 text-[15px] font-bold text-[#334766]" colSpan="7">
                  Loading recent predictions...
                </td>
              </tr>
            ) : visiblePredictions.length > 0 ? (
              visiblePredictions.map((prediction) => (
                <tr key={prediction.id || `${prediction.patient_id}-${prediction.generated_at}`} className="border-b border-[#eef3fa] last:border-0">
                  <td className="table-body break-words px-5 py-4 font-semibold text-[#20365f]">{formatDate(prediction.generated_at)}</td>
                  <td className="table-body break-words px-5 py-4 font-black text-[#071b49]">{prediction.patient_id || 'Not recorded'}</td>
                  <td className="table-body break-words px-5 py-4 font-semibold text-[#334766]">{prediction.surgery_type || 'Not recorded'}</td>
                  <td className="table-body break-words px-5 py-4 font-semibold text-[#334766]">{prediction.patient_disposition || 'Not recorded'}</td>
                  <td className="min-w-[150px] px-5 py-4"><RiskBadge risk={prediction.risk_level} /></td>
                  <td className="table-body px-5 py-4 font-black text-[#071b49]">{Math.round(Number(prediction.predicted_probability || 0))}%</td>
                  <td className="table-body break-words px-5 py-4 font-semibold text-[#334766]">{prediction.model_version || 'v1.0'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-5 py-5 text-[15px] font-bold text-[#334766]" colSpan="7">
                  No recent predictions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-[#cbd8e8] bg-white px-5 py-4 text-[13px] font-bold text-[#334766] md:flex-row md:items-center md:justify-between md:px-6">
        <span>
          Showing {showingStart}-{showingEnd} of {predictions.length} latest predictions
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage === 1 || loading}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="btn-text btn btn-light rounded-[10px] border border-[#cbd8e8] bg-[#f8fbff] px-3 py-2 font-extrabold text-[#071b49] disabled:opacity-50"
          >
            Previous
          </button>
          <span className="rounded-[10px] bg-[#eaf2ff] px-3 py-2 text-[13px] font-black text-[#1768f2]">
            Page {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage === totalPages || loading}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            className="btn-text btn btn-light rounded-[10px] border border-[#cbd8e8] bg-[#f8fbff] px-3 py-2 font-extrabold text-[#071b49] disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  )
}

function sortPredictionsByDate(items) {
  return [...items].sort((a, b) => {
    const left = Date.parse(a?.generated_at || '')
    const right = Date.parse(b?.generated_at || '')
    if (Number.isNaN(left) && Number.isNaN(right)) return 0
    if (Number.isNaN(left)) return 1
    if (Number.isNaN(right)) return -1
    return right - left
  })
}

function RiskBadge({ risk }) {
  const riskTone = getRiskTone(risk)

  return (
    <span className={`risk-badge-text inline-flex min-w-[112px] items-center justify-center rounded-full border px-4 py-2 text-center font-black shadow-sm ${riskTone.tableBadge}`}>
      {riskTone.statusLabel}
    </span>
  )
}

function RiskStatusCard({ risk }) {
  const riskTone = getRiskTone(risk)

  return (
    <div className="w-[176px] shrink-0 rounded-[14px] border border-[#dce5f0] bg-white px-4 py-3 text-center shadow-[0_10px_24px_rgba(7,27,73,0.10)]">
      <p className="small-text font-black uppercase tracking-[0.12em] text-[#17325d]">Risk status</p>
      <div className={`risk-badge-text mx-auto mt-3 inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full px-4 py-2 font-black text-white shadow-sm ${riskTone.statusPill}`}>
        <WarningIcon className="h-4 w-4 shrink-0" />
        <span>{riskTone.statusLabel}</span>
      </div>
      <p className="small-text mt-2 font-extrabold text-[#53668a]">{riskTone.helperText}</p>
    </div>
  )
}

function WarningIcon({ className = '' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.3 4.1 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function getRiskTone(risk) {
  const normalized = String(risk || '').trim().toLowerCase()

  if (normalized.includes('high')) {
    return {
      label: 'High',
      statusLabel: 'High Risk',
      helperText: 'Urgent attention',
      currentBadge: 'bg-[#dc2626] text-white shadow-sm',
      badge: 'border-[#ffd0d0] bg-[#fff1f1] text-[#d92d2d]',
      tableBadge: 'border-[#fecaca] bg-[#dc2626] text-white',
      statusPill: 'bg-gradient-to-r from-[#ef4444] to-[#b91c1c]',
      text: 'text-[#dc2626]',
    }
  }

  if (normalized.includes('moderate') || normalized.includes('medium')) {
    return {
      label: 'Moderate',
      statusLabel: 'Moderate Risk',
      helperText: 'Close monitoring',
      currentBadge: 'bg-[#f59e0b] text-white shadow-sm',
      badge: 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]',
      tableBadge: 'border-[#fbbf24] bg-[#f59e0b] text-white',
      statusPill: 'bg-gradient-to-r from-[#f59e0b] to-[#d97706]',
      text: 'text-[#d97706]',
    }
  }

  if (normalized.includes('low')) {
    return {
      label: 'Low',
      statusLabel: 'Low Risk',
      helperText: 'Stable',
      currentBadge: 'bg-[#16a34a] text-white shadow-sm',
      badge: 'border-[#cdeed9] bg-[#f1fbf5] text-[#168246]',
      tableBadge: 'border-[#bbf7d0] bg-[#16a34a] text-white',
      statusPill: 'bg-gradient-to-r from-[#22c55e] to-[#15803d]',
      text: 'text-[#16a34a]',
    }
  }

  return {
    label: 'Unknown',
    statusLabel: 'Unknown Risk',
    helperText: 'Needs review',
    currentBadge: 'bg-[#2563eb] text-white shadow-sm',
    badge: 'border-[#d9e2ef] bg-[#f8fbff] text-[#53668a]',
    tableBadge: 'border-[#cbd5e1] bg-[#475569] text-white',
    statusPill: 'bg-gradient-to-r from-[#64748b] to-[#334155]',
    text: 'text-[#2563eb]',
  }
}

function formatDate(value) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatModelMetric(value, fallback) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  const normalized = numeric > 1 ? numeric / 100 : numeric
  return normalized.toFixed(2)
}

function toneClass(tone, kind) {
  const map = {
    blue: {
      icon: 'bg-[#1768f2]',
      iconSoft: 'bg-[#eaf2ff]',
      chip: 'bg-[#1768f2] text-white shadow-sm',
      panel: 'border-[#c7dafb] bg-[#f7fbff]',
      stepNumber: 'bg-[#dbeafe] text-[#1768f2]',
      text: 'text-[#1768f2]',
    },
    green: {
      icon: 'bg-[#31b966]',
      iconSoft: 'bg-[#eaf8ef]',
      chip: 'bg-[#16a34a] text-white shadow-sm',
      panel: 'border-[#ccebd8] bg-[#f4fbf7]',
      stepNumber: 'bg-[#dcf5e6] text-[#31b966]',
      text: 'text-[#31b966]',
    },
    orange: {
      icon: 'bg-[#ff9f12]',
      iconSoft: 'bg-[#fff0e6]',
      chip: 'bg-[#f97316] text-white shadow-sm',
      panel: 'border-[#ffd7b2] bg-[#fff8f1]',
      stepNumber: 'bg-[#ffead6] text-[#ff9f12]',
      text: 'text-[#ff8a00]',
    },
    purple: {
      icon: 'bg-[#8b5cf6]',
      iconSoft: 'bg-[#f0ebff]',
      chip: 'bg-[#7c3aed] text-white shadow-sm',
      panel: 'border-[#d8ccff] bg-[#fbf9ff]',
      stepNumber: 'bg-[#eee7ff] text-[#8b5cf6]',
      text: 'text-[#8b5cf6]',
    },
    teal: {
      icon: 'bg-[#0f766e]',
      iconSoft: 'bg-[#ccfbf1]',
      chip: 'bg-[#0f766e] text-white shadow-sm',
      panel: 'border-[#99f6e4] bg-[#f0fdfa]',
      stepNumber: 'bg-[#ccfbf1] text-[#0f766e]',
      text: 'text-[#0f766e]',
    },
  }

  return map[tone][kind]
}

function Icon({ name, className = '' }) {
  const common = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    viewBox: '0 0 24 24',
  }

  const paths = {
    hospital: (
      <>
        <path d="M3 21h18" />
        <path d="M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-6h6v6" />
        <path d="M10 9h4" />
        <path d="M12 7v4" />
      </>
    ),
    trendUp: (
      <>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    warning: (
      <>
        <path d="m12 3 10 18H2L12 3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="M12 8v7" />
        <path d="M9 11l3-3 3 3" />
      </>
    ),
    checkCircle: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12l2.5 2.5L16 9" />
      </>
    ),
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    brain: (
      <>
        <path d="M9 3a3 3 0 0 0-3 3v.5A3.5 3.5 0 0 0 5 13a3.5 3.5 0 0 0 1 6.4" />
        <path d="M15 3a3 3 0 0 1 3 3v.5a3.5 3.5 0 0 1 1 6.5 3.5 3.5 0 0 1-1 6.4" />
        <path d="M9 3v18" />
        <path d="M15 3v18" />
        <path d="M9 8H6" />
        <path d="M15 8h3" />
        <path d="M9 14H5" />
        <path d="M15 14h4" />
      </>
    ),
    clipboard: (
      <>
        <path d="M8 4h8" />
        <path d="M9 2h6v4H9z" />
        <path d="M6 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1" />
        <path d="M8 12h8" />
        <path d="M8 16h8" />
      </>
    ),
  }

  return <svg {...common}>{paths[name]}</svg>
}
