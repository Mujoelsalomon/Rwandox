import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getSession } from '../authSession.js'
import { API_BASE_URL } from '../config/api.js'
import { MODEL_REGISTRY_UPDATED_EVENT, PREDICTION_HISTORY_UPDATED_EVENT } from '../predictionEvents'

function authHeaders(extraHeaders = {}) {
  const session = getSession()
  return {
    Authorization: `Bearer ${session?.token || ''}`,
    'X-User-Email': session?.email || '',
    'X-User-Username': session?.username || '',
    ...extraHeaders,
  }
}

function dashboardMetrics(activeModel, t, predictions) {
  const modelMetrics = activeModel?.metrics || {}
  const aucMetric = modelMetrics.test_auc
    ?? modelMetrics.val_roc_auc
    ?? modelMetrics.val_roc_auc_weighted_ovr
    ?? modelMetrics.val_auc
    ?? modelMetrics.auc
    ?? activeModel?.test_auc
    ?? activeModel?.val_roc_auc
    ?? activeModel?.val_roc_auc_weighted_ovr
    ?? activeModel?.val_auc
    ?? activeModel?.auc
  const aucValue = formatModelMetric(
    aucMetric
  )
  const sensitivityMetric = modelMetrics.test_sensitivity
    ?? modelMetrics.val_sensitivity
    ?? modelMetrics.sensitivity
    ?? modelMetrics.val_recall_weighted
    ?? activeModel?.test_sensitivity
    ?? activeModel?.val_sensitivity
    ?? activeModel?.sensitivity
    ?? activeModel?.val_recall_weighted
  const sensitivityValue = formatModelMetric(sensitivityMetric)
  const todayPredictions = predictions.filter(isTodayPrediction)
  const highRiskToday = todayPredictions.filter((prediction) => riskBucket(prediction.risk_level) === 'High').length
  const highRiskTotal = predictions.filter((prediction) => riskBucket(prediction.risk_level) === 'High').length
  const averageRisk = averageProbability(predictions)

  return [
  {
    label: t('predictionsToday'),
    value: String(todayPredictions.length),
    sub: t('highRiskCasesCount', { count: highRiskToday }),
    chip: predictions.length ? t('total') : t('noRecentPredictions'),
    chipTone: 'blue',
    icon: 'trendUp',
    iconTone: 'blue',
  },
  {
    label: t('averageRiskScore'),
    value: averageRisk === null ? 'No data' : `${averageRisk}%`,
    sub: predictions.length ? t('acrossAllAssessedPatients') : t('noRecentPredictions'),
    chip: `${predictions.length}`,
    chipTone: 'green',
    icon: 'users',
    iconTone: 'green',
  },
  {
    label: t('highRiskAlerts'),
    value: String(highRiskTotal),
    sub: t('requireCloseOxygenReview'),
    chip: highRiskTotal ? t('critical') : t('stable'),
    chipTone: 'orange',
    icon: 'warning',
    iconTone: 'orange',
  },
  {
    label: t('modelAuc'),
    value: aucValue,
    sub: t('latestValidatedVersion'),
    chip: aucValue === 'No data' ? t('noData', { defaultValue: 'No data' }) : (
      modelMetrics.auc_classification
      || modelMetrics.val_roc_auc_classification
      || modelMetrics.val_roc_auc_weighted_ovr_classification
      || modelMetrics.val_auc_classification
      || aucClassification(aucMetric)
    ),
    chipTone: 'purple',
    icon: 'shield',
    iconTone: 'purple',
  },
  {
    label: t('modelSensitivity'),
    value: sensitivityValue,
    sub: t('oxygenRequirementDetection'),
    chip: sensitivityValue === 'No data' ? t('noData', { defaultValue: 'No data' }) : (
      modelMetrics.test_sensitivity_classification
      || modelMetrics.val_sensitivity_classification
      || modelMetrics.sensitivity_classification
      || modelMetrics.val_recall_weighted_classification
      || sensitivityClassification(sensitivityMetric)
    ),
    chipTone: 'teal',
    icon: 'checkCircle',
    iconTone: 'teal',
  },
  ]
}

const workflowSteps = [
  { titleKey: 'patientAssessment', subKey: 'enterPatientClinicalData', tone: 'blue', icon: 'user' },
  { titleKey: 'riskPrediction', subKey: 'aiModelCalculatesRisk', tone: 'green', icon: 'brain' },
  { titleKey: 'reviewResults', subKey: 'checkRiskLevelAlerts', tone: 'orange', icon: 'warning' },
  { titleKey: 'clinicalDecision', subKey: 'planOxygenManagement', tone: 'purple', icon: 'clipboard' },
]

const recentPredictionsPageSize = 10

export default function DashboardContent({
  activeModel,
  onRefreshModel,
}) {
  const { t } = useTranslation()
  const [predictions, setPredictions] = useState([])
  const [predictionsLoading, setPredictionsLoading] = useState(true)
  const [predictionsStatus, setPredictionsStatus] = useState('')
  const latestPrediction = predictions[0] || null
  const riskScore = latestPrediction ? normalizeProbability(latestPrediction.predicted_probability) : 0
  const currentRiskLabel = latestPrediction?.risk_level || ''
  const latestFactors = normalizeList(latestPrediction?.contributing_factors)
  const metrics = dashboardMetrics(activeModel, t, predictions)

  useEffect(() => {
    let active = true

    async function loadDashboardPredictions({ showLoading = false } = {}) {
      if (showLoading) setPredictionsLoading(true)
      try {
        const resp = await fetch(`${API_BASE_URL}/prediction-history`, {
          credentials: 'include',
          headers: authHeaders(),
        })
        const data = await resp.json()
        if (!active) return
        if (!resp.ok) throw new Error(data.error || 'Could not load recent predictions.')
        setPredictions(sortPredictionsByDate(Array.isArray(data.predictions) ? data.predictions : []))
        setPredictionsStatus('')
      } catch (error) {
        console.error(error)
        if (active) {
          setPredictions([])
          setPredictionsStatus('Could not load recent predictions from the backend.')
        }
      } finally {
        if (active) setPredictionsLoading(false)
      }
    }

    function refreshDashboard({ showLoading = false } = {}) {
      loadDashboardPredictions({ showLoading })
      if (typeof onRefreshModel === 'function') onRefreshModel()
    }

    function handlePredictionHistoryUpdated(event) {
      const prediction = normalizeEventPrediction(event?.detail?.prediction)
      if (prediction) {
        setPredictions((current) => sortPredictionsByDate(upsertPrediction(current, prediction)))
      }
      refreshDashboard({ showLoading: true })
    }

    function handleModelRegistryUpdated() {
      refreshDashboard({ showLoading: false })
    }

    function handleWindowFocus() {
      refreshDashboard({ showLoading: false })
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshDashboard({ showLoading: false })
      }
    }

    refreshDashboard()
    window.addEventListener(PREDICTION_HISTORY_UPDATED_EVENT, handlePredictionHistoryUpdated)
    window.addEventListener(MODEL_REGISTRY_UPDATED_EVENT, handleModelRegistryUpdated)
    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      active = false
      window.removeEventListener(PREDICTION_HISTORY_UPDATED_EVENT, handlePredictionHistoryUpdated)
      window.removeEventListener(MODEL_REGISTRY_UPDATED_EVENT, handleModelRegistryUpdated)
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [onRefreshModel])

  return (
    <div className="container-fluid min-w-0 space-y-4 px-0 pb-4">
      <HeroCard t={t} />

      <section className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
        <RiskDistribution predictions={predictions} />
        <RiskTrend predictions={predictions} riskScore={riskScore} />
      </section>

      <WorkflowPanel t={t} />

      <AssessmentPredictionPanel
        factorChips={latestFactors}
        predictions={predictions}
        predictionsLoading={predictionsLoading}
        predictionsStatus={predictionsStatus}
        riskLabel={currentRiskLabel}
        riskScore={riskScore}
      />
    </div>
  )
}

function HeroCard() {
  const { t } = useTranslation()
  return (
    <section className="card shadow-sm rounded-4 mb-3 mx-auto max-w-[720px] rounded-[14px] border border-[#bfdbfe] bg-white px-4 py-3 text-center md:px-5 md:py-4">
      <h1 className="page-title fw-black mb-0 font-black text-[#071b49]">
        {t('dashboardHeroTitle')}
      </h1>
    </section>
  )
}

function MetricCard({ label, value, sub, chip, chipTone, icon, iconTone }) {
  return (
    <article className="card shadow-sm rounded-4 flex h-full min-w-0 flex-col rounded-[14px] border border-[#cbd8e8] bg-white px-4 py-4">
      <div className="flex flex-1 gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] ${toneClass(iconTone, 'iconSoft')}`}>
          <Icon name={icon} className={`h-6 w-6 ${toneClass(iconTone, 'text')}`} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-extrabold leading-6 text-[#071b49]">{label}</h2>
          <p className="mt-2 text-[38px] font-black leading-none text-[#071b49]">{value}</p>
          <p className="mt-2 text-[16px] font-semibold leading-6 text-[#334766]">{sub}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 pl-16">
        <span className={`badge inline-flex max-w-full items-center justify-center whitespace-normal rounded-pill rounded-[7px] px-2.5 py-1 text-center text-[13px] font-extrabold leading-4 ${toneClass(chipTone, 'chip')}`}>
          {chipTone === 'green' && <span className="mr-1">↓</span>}
          {chipTone === 'blue' && <span className="mr-1">↑</span>}
          {chip}
        </span>
      </div>
    </article>
  )
}

function RiskDistribution({ predictions }) {
  const { t } = useTranslation()
  const rows = riskDistributionRows(predictions)
  const total = predictions.length
  const gradient = riskDistributionGradient(rows)

  return (
    <section className="card shadow-sm rounded-4 mb-3 min-w-0 overflow-hidden rounded-[16px] border border-[#cbd8e8] bg-white px-5 py-5 md:px-6">
      <h2 className="section-title h4 fw-bold font-black text-[#071b49]">{t('riskDistribution')}</h2>
      <div className="mt-3 flex flex-col items-center gap-8 md:flex-row md:justify-center">
        <div
          className="relative flex h-[170px] w-[170px] shrink-0 items-center justify-center rounded-full"
          style={{ background: gradient }}
        >
          <div className="flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full bg-white shadow-inner">
            <span className="text-[32px] font-black leading-none text-[#071b49]">{total}</span>
            <span className="text-[16px] text-[#53668a]">{t('total')}</span>
          </div>
        </div>

        <div className="w-full max-w-[340px] space-y-5">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[16px_1fr_auto] items-center gap-3 text-[18px]">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.color }} />
              <span className="font-semibold text-[#334766]">{translateRiskLabel(row.label, t)}</span>
              <span className="font-medium text-[#20365f]">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function RiskTrend({ predictions, riskScore }) {
  const { t } = useTranslation()
  const trend = riskTrendPoints(predictions)
  const points = trend.points
  const path = points.length ? `M${points.map(([x, y]) => `${x} ${y}`).join(' L')}` : ''
  const fillPath = points.length ? `${path} L94 80 L8 80 Z` : ''

  return (
    <section className="card shadow-sm rounded-4 mb-3 min-w-0 overflow-hidden rounded-[16px] border border-[#cbd8e8] bg-white px-5 py-5 md:px-6">
      <h2 className="section-title h4 fw-bold font-black text-[#071b49]">{t('riskTrendLast7Days')}</h2>
      <div className="relative mt-3 h-[175px]">
        <div className="absolute inset-x-0 top-2 h-px bg-[#dfe7f2]" />
        <div className="absolute inset-x-0 top-[46px] h-px bg-[#dfe7f2]" />
        <div className="absolute inset-x-0 top-[90px] h-px bg-[#dfe7f2]" />
        <div className="absolute inset-x-0 top-[132px] h-px bg-[#dfe7f2]" />
        <div className="absolute left-0 top-0 flex h-[150px] flex-col justify-between text-[16px] font-semibold text-[#334766]">
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
          {fillPath && <path d={fillPath} fill="url(#riskFill)" />}
          {points.length > 0 && <polyline points={points.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="#1768f2" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />}
          {points.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.9" fill="#1768f2" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <div className="absolute right-0 top-[32px] rounded-[6px] bg-[#1768f2] px-3 py-2 text-[16px] font-extrabold text-white">
          {riskScore}%
        </div>
        <div className="absolute bottom-0 left-12 right-3 grid grid-cols-7 text-center text-[12px] font-semibold text-[#334766] sm:text-[16px]">
          {trend.labels.map((label) => <span key={label}>{label}</span>)}
        </div>
      </div>
    </section>
  )
}

function WorkflowPanel() {
  const { t } = useTranslation()
  return (
    <section className="card shadow-sm rounded-4 mb-3 min-w-0 overflow-hidden rounded-[16px] border border-[#cbd8e8] bg-white px-5 py-4 md:px-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="section-title font-black text-[#071b49]">{t('systemWorkflow')}</h2>
          <p className="small-text font-semibold text-[#334766]">{t('assessManagePatientRisk')}</p>
        </div>
      </div>
      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {workflowSteps.map((step, index) => (
          <React.Fragment key={step.titleKey}>
            <WorkflowStep index={index + 1} {...step} />
          </React.Fragment>
        ))}
      </div>
    </section>
  )
}

function WorkflowStep({ index, titleKey, subKey, tone, icon }) {
  const { t } = useTranslation()
  return (
    <div className={`card flex min-h-[58px] min-w-0 items-center gap-3 rounded-[10px] border px-3 py-2 ${toneClass(tone, 'panel')}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[18px] font-black ${toneClass(tone, 'stepNumber')}`}>
        {index}
      </div>
      <Icon name={icon} className={`h-6 w-6 shrink-0 ${toneClass(tone, 'text')}`} />
      <div className="min-w-0">
        <p className="break-words text-[16px] font-extrabold leading-5 text-[#071b49]">{t(titleKey)}</p>
        <p className="break-words text-[14px] font-semibold leading-5 text-[#334766]">{t(subKey)}</p>
      </div>
    </div>
  )
}

function AssessmentPredictionPanel({ factorChips, predictions, predictionsLoading, predictionsStatus, riskLabel, riskScore }) {
  const { t } = useTranslation()
  const hasPredictions = predictions.length > 0
  const riskTone = getRiskTone(riskLabel)

  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.75fr)]">
      <RecentPredictionsTable loading={predictionsLoading} predictions={predictions} status={predictionsStatus} />

      <div className="min-w-0 space-y-5">
        <section className="card shadow rounded-4 rounded-[20px] border border-[#cbd8e8] bg-white px-6 py-6 text-[#071b49]">
          <div className="flex items-start justify-between gap-4">
            <h2 className="section-title max-w-[170px] font-black tracking-wide">
              {t('currentPrediction')}
            </h2>
            {hasPredictions ? <RiskStatusCard risk={riskLabel} /> : null}
          </div>
          <p className={`prediction-value mt-7 ${hasPredictions ? riskTone.text : 'text-[#64748b]'}`}>
            {hasPredictions ? `${riskScore}%` : 'No data'}
          </p>
          <p className="body-text mt-5 max-w-[340px] font-extrabold text-[#20365f]">
            {hasPredictions ? t('probabilityExplanation') : t('noRecentPredictions')}
          </p>
        </section>

        <section className="card shadow-sm rounded-4 rounded-[20px] border border-[#cbd8e8] bg-white px-5 py-5">
          <h2 className="section-title font-black text-[#071b49]">
            {t('keyContributingFactors')}
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {hasPredictions && factorChips.length > 0 ? factorChips.map((chip) => (
              <span
                key={chip}
                className="risk-badge-text badge rounded-pill border border-[#fecaca] bg-[#dc2626] px-3 py-2 font-extrabold text-white shadow-sm"
              >
                {chip}
              </span>
            )) : (
              <span className="small-text font-bold text-[#64748b]">{t('noRecentPredictions')}</span>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}

function RecentPredictionsTable({ loading, predictions, status }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [predictions.length])

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
            {t('recentPredictions')}
          </h2>
          <p className="small-text mt-1 font-semibold text-[#334766]">
            {t('latestGeneratedResults')}
          </p>
        </div>
        <span className="risk-badge-text badge rounded-pill w-fit bg-[#1768f2] px-3 py-2 font-extrabold uppercase tracking-[0.08em] text-white">
          {t('latestRange', { start: showingStart, end: showingEnd, total: predictions.length || 0 })}
        </span>
      </div>

      {status && (
        <div className="alert alert-warning rounded-4 mx-5 mt-4 border border-[#f59e0b] bg-[#fffbeb] px-4 py-3 text-[15px] font-bold text-[#713f12] md:mx-6">
          {status}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table table-hover align-middle mb-0 min-w-[760px] w-full text-left">
          <thead>
            <tr className="table-header border-b border-[#cbd8e8] bg-[#eaf2ff] font-black uppercase tracking-[0.08em] text-[#071b49]">
              <th className="px-5 py-3">{t('generated')}</th>
              <th className="px-5 py-3">{t('patientId')}</th>
              <th className="px-5 py-3">{t('surgery')}</th>
              <th className="px-5 py-3">{t('disposition')}</th>
              <th className="px-5 py-3">{t('risk')}</th>
              <th className="px-5 py-3">{t('probability')}</th>
              <th className="px-5 py-3">{t('model')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-5 py-5 text-[17px] font-bold text-[#334766]" colSpan="7">
                  {t('loadingRecentPredictions')}
                </td>
              </tr>
            ) : visiblePredictions.length > 0 ? (
              visiblePredictions.map((prediction) => (
                <tr key={prediction.id || `${prediction.patient_id}-${prediction.generated_at}`} className="border-b border-[#eef3fa] last:border-0">
                  <td className="table-body break-words px-5 py-4 font-semibold text-[#20365f]">{formatDate(prediction.generated_at)}</td>
                  <td className="table-body break-words px-5 py-4 font-black text-[#071b49]">{prediction.patient_id || t('notRecorded')}</td>
                  <td className="table-body break-words px-5 py-4 font-semibold text-[#334766]">{prediction.surgery_type || t('notRecorded')}</td>
                  <td className="table-body break-words px-5 py-4 font-semibold text-[#334766]">{prediction.patient_disposition || t('notRecorded')}</td>
                  <td className="min-w-[150px] px-5 py-4"><RiskBadge risk={prediction.risk_level} /></td>
                  <td className="table-body px-5 py-4 font-black text-[#071b49]">{displayPredictionProbability(prediction)}</td>
                  <td className="table-body break-words px-5 py-4 font-semibold text-[#334766]">{prediction.model_version || t('notRecorded')}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-5 py-5 text-[17px] font-bold text-[#334766]" colSpan="7">
                  {t('noRecentPredictions')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-[#cbd8e8] bg-white px-5 py-4 text-[15px] font-bold text-[#334766] md:flex-row md:items-center md:justify-between md:px-6">
        <span>
          {t('showingLatestPredictions', { start: showingStart, end: showingEnd, total: predictions.length })}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage === 1 || loading}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="btn-text btn btn-light rounded-[10px] border border-[#cbd8e8] bg-[#f8fbff] px-3 py-2 font-extrabold text-[#071b49] disabled:opacity-50"
          >
            {t('previous')}
          </button>
          <span className="rounded-[10px] bg-[#eaf2ff] px-3 py-2 text-[15px] font-black text-[#1768f2]">
            {t('pageCount', { current: currentPage, total: totalPages })}
          </span>
          <button
            type="button"
            disabled={currentPage === totalPages || loading}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            className="btn-text btn btn-light rounded-[10px] border border-[#cbd8e8] bg-[#f8fbff] px-3 py-2 font-extrabold text-[#071b49] disabled:opacity-50"
          >
            {t('next')}
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

function upsertPrediction(items, prediction) {
  if (!prediction?.id) return [prediction, ...items]
  const index = items.findIndex((item) => String(item.id) === String(prediction.id))
  if (index === -1) return [prediction, ...items]
  return items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...prediction } : item))
}

function normalizeEventPrediction(prediction) {
  if (!prediction || !prediction.generated_at) return null
  const probability = normalizeProbability(prediction.predicted_probability ?? prediction.probability)
  const riskLevel = prediction.risk_level || riskFromProbability(probability)

  return {
    id: prediction.id,
    patient_id: prediction.patient_id || prediction.hospital_id || 'Not recorded',
    surgery_type: prediction.surgery_type || prediction.type_of_surgery || 'Not recorded',
    patient_disposition: prediction.patient_disposition || dispositionFromRisk(riskLevel),
    predicted_probability: probability,
    display_probability: prediction.display_probability || formatDisplayProbability(prediction.calibrated_probability ?? prediction.predicted_probability ?? prediction.probability),
    risk_level: riskLevel,
    model_version: prediction.model_version || prediction.active_model || 'Not recorded',
    generated_at: prediction.generated_at,
    recommendations: prediction.recommendations || [],
    contributing_factors: prediction.contributing_factors || [],
  }
}

function normalizeProbability(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  const percent = numeric <= 1 ? numeric * 100 : numeric
  return Math.min(100, Math.max(0, Math.round(percent)))
}

function formatDisplayProbability(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 'Not available'
  const probability = numeric > 1 ? numeric / 100 : numeric
  if (probability <= 0.01) return '<1%'
  if (probability >= 0.99) return '>99%'
  return `${(probability * 100).toFixed(1)}%`
}

function displayPredictionProbability(prediction) {
  return prediction.display_probability || formatDisplayProbability(prediction.calibrated_probability ?? prediction.predicted_probability)
}

function riskFromProbability(probability) {
  if (probability >= 70) return 'High'
  if (probability >= 30) return 'Moderate'
  return 'Low'
}

function dispositionFromRisk(risk) {
  const bucket = riskBucket(risk)
  if (bucket === 'High') return 'ICU'
  if (bucket === 'Moderate') return 'HDU'
  return 'Ward'
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item) return ''
        if (typeof item === 'object') return item.display || item.feature || item.label || JSON.stringify(item)
        return String(item)
      })
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function averageProbability(predictions) {
  if (!predictions.length) return null
  const total = predictions.reduce((sum, prediction) => sum + normalizeProbability(prediction.predicted_probability), 0)
  return Math.round(total / predictions.length)
}

function riskBucket(risk) {
  const normalized = String(risk || '').toLowerCase()
  if (normalized.includes('high')) return 'High'
  if (normalized.includes('moderate') || normalized.includes('medium')) return 'Moderate'
  if (normalized.includes('low')) return 'Low'
  return 'Unknown'
}

function isTodayPrediction(prediction) {
  const date = new Date(prediction?.generated_at || '')
  if (Number.isNaN(date.getTime())) return false
  const today = new Date()
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
}

function riskDistributionRows(predictions) {
  const counts = { High: 0, Moderate: 0, Low: 0 }
  predictions.forEach((prediction) => {
    const bucket = riskBucket(prediction.risk_level)
    if (counts[bucket] !== undefined) counts[bucket] += 1
  })
  const total = predictions.length
  return [
    { label: 'High Risk', count: counts.High, color: '#fb2d2d' },
    { label: 'Moderate Risk', count: counts.Moderate, color: '#ff9f12' },
    { label: 'Low Risk', count: counts.Low, color: '#31b966' },
  ].map((row) => ({
    ...row,
    percent: total ? Math.round((row.count / total) * 100) : 0,
    value: total ? `${row.count} (${Math.round((row.count / total) * 100)}%)` : '0 (0%)',
  }))
}

function riskDistributionGradient(rows) {
  if (rows.every((row) => row.count === 0)) return 'conic-gradient(#e2e8f0 0 100%)'
  let cursor = 0
  const segments = rows
    .filter((row) => row.percent > 0)
    .map((row) => {
      const start = cursor
      cursor += row.percent
      return `${row.color} ${start}% ${cursor}%`
    })
  return `conic-gradient(${segments.join(',')})`
}

function riskTrendPoints(predictions) {
  const days = lastSevenDays()
  const grouped = new Map(days.map((day) => [day.key, []]))
  predictions.forEach((prediction) => {
    const date = new Date(prediction.generated_at || '')
    if (Number.isNaN(date.getTime())) return
    const key = dateKey(date)
    if (grouped.has(key)) grouped.get(key).push(normalizeProbability(prediction.predicted_probability))
  })
  const xPositions = [8, 22, 37, 52, 67, 82, 94]
  const points = days
    .map((day, index) => {
      const values = grouped.get(day.key) || []
      if (!values.length) return null
      const average = values.reduce((sum, value) => sum + value, 0) / values.length
      return [xPositions[index], 80 - (average * 0.8)]
    })
    .filter(Boolean)
  return {
    labels: days.map((day) => day.label),
    points,
  }
}

function lastSevenDays() {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    return {
      key: dateKey(date),
      label: formatter.format(date),
    }
  })
}

function dateKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

function RiskBadge({ risk }) {
  const { t } = useTranslation()
  const riskTone = getRiskTone(risk)

  return (
    <span className={`risk-badge-text inline-flex min-w-[112px] items-center justify-center rounded-full border px-4 py-2 text-center font-black shadow-sm ${riskTone.tableBadge}`}>
      {translateRiskLabel(riskTone.statusLabel, t)}
    </span>
  )
}

function RiskStatusCard({ risk }) {
  const { t } = useTranslation()
  const riskTone = getRiskTone(risk)

  return (
    <div className="w-[176px] shrink-0 rounded-[14px] border border-[#dce5f0] bg-white px-4 py-3 text-center shadow-[0_10px_24px_rgba(7,27,73,0.10)]">
      <p className="small-text font-black uppercase tracking-[0.12em] text-[#17325d]">{t('riskStatus')}</p>
      <div className={`risk-badge-text mx-auto mt-3 inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full px-4 py-2 font-black text-white shadow-sm ${riskTone.statusPill}`}>
        <WarningIcon className="h-4 w-4 shrink-0" />
        <span>{translateRiskLabel(riskTone.statusLabel, t)}</span>
      </div>
      <p className="small-text mt-2 font-extrabold text-[#53668a]">{t(riskTone.helperKey)}</p>
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
      helperKey: 'urgentAttention',
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
      helperKey: 'closeMonitoring',
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
      helperKey: 'stable',
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
    helperKey: 'needsReview',
    currentBadge: 'bg-[#2563eb] text-white shadow-sm',
    badge: 'border-[#d9e2ef] bg-[#f8fbff] text-[#53668a]',
    tableBadge: 'border-[#cbd5e1] bg-[#475569] text-white',
    statusPill: 'bg-gradient-to-r from-[#64748b] to-[#334155]',
    text: 'text-[#2563eb]',
  }
}

function translateRiskLabel(label, t) {
  const normalized = String(label || '').toLowerCase()
  if (normalized.includes('high')) return t('highRisk')
  if (normalized.includes('moderate') || normalized.includes('medium')) return t('moderateRisk')
  if (normalized.includes('low')) return t('lowRisk')
  return t('unknownRisk')
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

function formatModelMetric(value, fallback = 'No data') {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  const normalized = numeric > 1 ? numeric / 100 : numeric
  return normalized.toFixed(2)
}

function aucClassification(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 'No data'
  const normalized = numeric > 1 ? numeric / 100 : numeric
  if (normalized >= 0.9 && normalized < 1) return 'Outstanding'
  if (normalized >= 0.8 && normalized < 0.9) return 'Excellent'
  if (normalized >= 0.7 && normalized < 0.8) return 'Acceptable/Good'
  if (normalized >= 0.5 && normalized < 0.7) return 'Poor'
  return 'No data'
}

function sensitivityClassification(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 'No data'
  const normalized = numeric > 1 ? numeric / 100 : numeric
  if (normalized >= 0.9 && normalized <= 1) return 'Excellent detection'
  if (normalized >= 0.8 && normalized < 0.9) return 'Strong detection'
  if (normalized >= 0.7 && normalized < 0.8) return 'Good'
  if (normalized >= 0.5 && normalized < 0.7) return 'Needs review'
  return 'Needs Review'
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
