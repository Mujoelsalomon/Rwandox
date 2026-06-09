import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PREDICTION_HISTORY_UPDATED_EVENT } from '../predictionEvents.js'
import { API_BASE_URL } from '../config/api.js'
import i18n from '../i18n'

const pageSizes = [10, 25, 50, 100]

export default function PredictionHistoryContent() {
  const { t } = useTranslation()
  const [predictions, setPredictions] = useState([])
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('All')
  const [dispositionFilter, setDispositionFilter] = useState('All')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [selectedPrediction, setSelectedPrediction] = useState(null)

  useEffect(() => {
    let active = true

    async function loadHistory({ showLoading = false } = {}) {
      if (showLoading) setLoading(true)
      try {
        const resp = await fetch(`${API_BASE_URL}/prediction-history`, { credentials: 'include' })
        const data = await resp.json()
        if (!active) return
        if (!resp.ok) throw new Error(data.error || 'Could not load prediction history.')
        setPredictions(data.predictions || [])
        setStatus('')
      } catch (error) {
        console.error(error)
        if (active) {
          setPredictions([])
          setStatus('Could not load prediction history from the backend.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadHistory()
    function handlePredictionHistoryUpdated() {
      loadHistory({ showLoading: true })
      setPage(1)
    }

    window.addEventListener(PREDICTION_HISTORY_UPDATED_EVENT, handlePredictionHistoryUpdated)
    return () => {
      active = false
      window.removeEventListener(PREDICTION_HISTORY_UPDATED_EVENT, handlePredictionHistoryUpdated)
    }
  }, [])

  const filteredPredictions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return predictions.filter((prediction) => {
      const matchesSearch = !normalizedSearch
        || prediction.patient_id?.toLowerCase().includes(normalizedSearch)
        || prediction.surgery_type?.toLowerCase().includes(normalizedSearch)
        || prediction.model_version?.toLowerCase().includes(normalizedSearch)
      const matchesRisk = riskFilter === 'All' || prediction.risk_level === riskFilter
      const matchesDisposition = dispositionFilter === 'All' || prediction.patient_disposition === dispositionFilter

      return matchesSearch && matchesRisk && matchesDisposition
    })
  }, [dispositionFilter, predictions, riskFilter, search])

  const summary = useMemo(() => {
    const total = predictions.length
    const high = predictions.filter((prediction) => prediction.risk_level === 'High').length
    const average = total
      ? Math.round(predictions.reduce((sum, prediction) => sum + Number(prediction.predicted_probability || 0), 0) / total)
      : 0
    const latest = predictions[0]?.generated_at

    return { total, high, average, latest }
  }, [predictions])

  const totalPages = Math.max(1, Math.ceil(filteredPredictions.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const visiblePredictions = filteredPredictions.slice(startIndex, startIndex + pageSize)

  function updateFilter(setter, value) {
    setter(value)
    setPage(1)
  }

  function downloadHistory(format) {
    const params = new URLSearchParams({
      format: format === 'csv' ? 'csv' : 'pdf',
      search: search.trim(),
      risk: riskFilter,
      disposition: dispositionFilter,
    })
    window.location.href = `${API_BASE_URL}/prediction-history/report?${params.toString()}`
    setExportOpen(false)
  }

  return (
    <div className="container-fluid px-0">
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-4">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-xl">
              <div className="small-text text-primary fw-bold text-uppercase mb-2" style={{ letterSpacing: '0.14em' }}>
                {t('predictionHistory')}
              </div>
              <h1 className="page-title fw-black mb-2" style={{ color: '#071b49', fontWeight: 900 }}>
                {t('predictionHistoryTitle')}
              </h1>
              <p className="body-text mb-0 text-secondary">
                {t('predictionHistoryIntro')}
              </p>
            </div>
            <div className="col-12 col-xl-auto position-relative">
              <button
                className="btn btn-dark rounded-pill fw-bold px-4 py-2 w-100 w-xl-auto"
                type="button"
                onClick={() => setExportOpen((open) => !open)}
                aria-expanded={exportOpen}
              >
                {t('exportHistory')}
              </button>
              {exportOpen && (
                <div
                  className="position-absolute end-0 mt-2 rounded-4 bg-white shadow border p-2"
                  style={{ zIndex: 20, minWidth: 240 }}
                >
                  <button
                    className="btn btn-success rounded-4 fw-bold w-100 mb-2 py-2"
                    type="button"
                    onClick={() => downloadHistory('pdf')}
                  >
                    Download PDF report
                  </button>
                  <button
                    className="btn btn-warning rounded-4 fw-bold w-100 py-2"
                    type="button"
                    onClick={() => downloadHistory('csv')}
                  >
                    Download CSV file
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <SummaryCard label={t('totalPredictions')} value={summary.total} accent="#1265dc" />
        <SummaryCard label={t('highRiskCases')} value={summary.high} accent="#ef4444" />
        <SummaryCard label={t('averageProbability')} value={`${summary.average}%`} accent="#facc15" />
        <SummaryCard label={t('latestGenerated')} value={summary.latest ? formatDate(summary.latest, true) : t('none')} accent="#22c55e" />
      </div>

      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-4">
          <div className="row g-3">
            <div className="col-12 col-xl-5">
              <label className="form-label fw-bold text-secondary">{t('search')}</label>
              <input
                className="form-control form-control-lg rounded-4"
                placeholder={t('searchHistoryPlaceholder')}
                value={search}
                onChange={(event) => updateFilter(setSearch, event.target.value)}
              />
            </div>
            <div className="col-12 col-md-4 col-xl">
              <FilterSelect label={t('risk')} value={riskFilter} onChange={(value) => updateFilter(setRiskFilter, value)} options={['All', 'High', 'Moderate', 'Low']} />
            </div>
            <div className="col-12 col-md-4 col-xl">
              <FilterSelect label={t('disposition')} value={dispositionFilter} onChange={(value) => updateFilter(setDispositionFilter, value)} options={['All', 'OPD', 'Ward', 'HDU', 'ICU']} />
            </div>
            <div className="col-12 col-md-4 col-xl">
              <FilterSelect label={t('tableSize')} value={String(pageSize)} onChange={(value) => {
                setPageSize(Number(value))
                setPage(1)
              }} options={pageSizes.map(String)} />
            </div>
          </div>
        </div>
      </div>

      {status && (
        <div className="alert alert-warning rounded-4 fw-semibold" role="alert">
          {status}
        </div>
      )}

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr className="table-header text-uppercase text-secondary">
                <th className="px-4 py-3">{t('generated')}</th>
                <th className="px-4 py-3">{t('patientId')}</th>
                <th className="px-4 py-3">{t('surgery')}</th>
                <th className="px-4 py-3">{t('disposition')}</th>
                <th className="px-4 py-3">{t('risk')}</th>
                <th className="px-4 py-3">{t('probability')}</th>
                <th className="px-4 py-3">{t('model')}</th>
                <th className="px-4 py-3">{t('clinicalNote')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-secondary fw-semibold" colSpan="8">{t('loadingPredictionHistory')}</td>
                </tr>
              ) : visiblePredictions.length > 0 ? (
                visiblePredictions.map((prediction) => (
                  <tr key={prediction.id}>
                    <td className="table-body px-4 py-3 fw-semibold text-nowrap">{formatDate(prediction.generated_at)}</td>
                    <td className="table-body px-4 py-3 fw-bold" style={{ color: '#071b49' }}>{prediction.patient_id}</td>
                    <td className="table-body px-4 py-3">{prediction.surgery_type || t('notRecorded')}</td>
                    <td className="table-body px-4 py-3">{prediction.patient_disposition || t('notRecorded')}</td>
                    <td className="table-body px-4 py-3"><RiskBadge risk={prediction.risk_level} /></td>
                    <td className="table-body px-4 py-3 fw-bold" style={{ color: '#071b49' }}>{Math.round(Number(prediction.predicted_probability || 0))}%</td>
                    <td className="table-body px-4 py-3">{prediction.model_version || 'v1.0'}</td>
                    <td className="table-body px-4 py-3 text-secondary" style={{ minWidth: 280 }}>
                      <ClinicalNote prediction={prediction} onOpen={() => setSelectedPrediction(prediction)} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-4 text-secondary fw-semibold" colSpan="8">{t('noPredictionHistory')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card-footer bg-white border-top">
          <div className="row g-3 align-items-center">
            <div className="col-12 col-md">
              <span className="text-secondary fw-semibold">
                Showing {filteredPredictions.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + pageSize, filteredPredictions.length)} of {filteredPredictions.length}
              </span>
            </div>
            <div className="col-12 col-md-auto">
              <nav aria-label="Prediction history pagination">
                <ul className="pagination mb-0">
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button className="page-link rounded-start-pill" onClick={() => setPage((value) => Math.max(1, value - 1))}>
                      {t('previous')}
                    </button>
                  </li>
                  <li className="page-item active">
                    <span className="page-link">
                      {currentPage} / {totalPages}
                    </span>
                  </li>
                  <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button className="page-link rounded-end-pill" onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                      {t('next')}
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {selectedPrediction && (
        <PredictionDetailModal
          prediction={selectedPrediction}
          onClose={() => setSelectedPrediction(null)}
        />
      )}
    </div>
  )
}

function SummaryCard({ label, value, accent }) {
  return (
    <div className="col-12 col-sm-6 col-xl-3">
      <div className="card border-0 shadow-sm rounded-4 h-100">
        <div className="card-body p-3">
          <div className="d-flex align-items-center gap-3">
            <span className="rounded-circle d-inline-block" style={{ width: 12, height: 12, backgroundColor: accent }} />
            <div>
              <div className="small-text text-secondary fw-bold">{label}</div>
              <div className="section-title fw-black" style={{ color: '#071b49', fontWeight: 900 }}>{value}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  const { t } = useTranslation()
  return (
    <>
      <label className="form-label fw-bold text-secondary">{label}</label>
      <select
        className="form-select form-select-lg rounded-4"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>{translateFilterOption(option, t)}</option>
        ))}
      </select>
    </>
  )
}

function RiskBadge({ risk }) {
  const { t } = useTranslation()
  const cls = risk === 'High'
    ? 'text-bg-danger'
    : risk === 'Moderate'
      ? 'text-bg-warning'
      : 'text-bg-success'

  return (
    <span className={`badge rounded-pill px-3 py-2 ${cls}`}>
      {translateRiskLabel(risk, t)}
    </span>
  )
}

function ClinicalNote({ prediction, onOpen }) {
  const { t } = useTranslation()
  const recommendation = firstRecommendation(prediction, t)
  const factors = normalizeFactors(prediction.contributing_factors)

  return (
    <div className="d-flex flex-column gap-2">
      <span>{recommendation}</span>
      <button
        type="button"
        className="btn btn-link d-inline-flex align-items-center gap-1 p-0 fw-bold text-decoration-none"
        style={{ color: '#1265dc', width: 'fit-content' }}
        onClick={onOpen}
      >
        {t('viewKeyFactorsCarePlan')}
        <span aria-hidden="true">&rsaquo;</span>
      </button>
      {factors.length > 0 && (
        <span className="small text-secondary">
          {t('keyFactor')}: {factors[0].display}
        </span>
      )}
    </div>
  )
}

function PredictionDetailModal({ prediction, onClose }) {
  const { t } = useTranslation()
  const probability = Math.round(Number(prediction.predicted_probability || 0))
  const factors = normalizeFactors(prediction.contributing_factors)
  const carePlan = buildCarePlan(prediction, t)

  return (
    <div
      className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center px-3 py-4"
      style={{ zIndex: 1050, backgroundColor: 'rgba(4, 18, 43, 0.55)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="prediction-detail-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="card border-0 shadow-lg rounded-4 w-100" style={{ maxWidth: 900, maxHeight: '92vh', overflow: 'auto' }}>
        <div className="card-body p-4 p-lg-5">
          <div className="d-flex flex-column flex-md-row justify-content-between gap-3">
            <div>
              <div className="small-text text-primary fw-bold text-uppercase mb-2" style={{ letterSpacing: '0.12em' }}>
                {t('predictionGuidance')}
              </div>
              <h2 id="prediction-detail-title" className="fw-black mb-2" style={{ color: '#071b49', fontWeight: 900 }}>
                {t('postoperativeOxygenPlan', { patient: prediction.patient_id || 'Patient' })}
              </h2>
              <p className="mb-0 text-secondary fw-semibold">
                {t('predictionDetailSummary', { risk: translateRiskLabel(prediction.risk_level, t), probability, disposition: prediction.patient_disposition || 'Ward' })}
              </p>
            </div>
            <button type="button" className="btn btn-light rounded-circle fw-bold align-self-start" onClick={onClose} aria-label={t('closeDetails')}>
              &times;
            </button>
          </div>

          <div className="row g-3 mt-3">
            <div className="col-12 col-lg-5">
              <section className="rounded-4 border bg-white p-4 h-100">
                <h3 className="card-title fw-black mb-3" style={{ color: '#071b49', fontWeight: 900 }}>{t('keyFactorsLedToPrediction')}</h3>
                {factors.length > 0 ? (
                  <div className="d-flex flex-column gap-2">
                    {factors.map((factor, index) => (
                      <div key={`${factor.feature}-${index}`} className="rounded-4 border bg-light px-3 py-3">
                        <p className="mb-1 fw-bold" style={{ color: '#071b49' }}>{index + 1}. {factor.display}</p>
                        {factor.impact && (
                          <p className="small-text mb-0 text-secondary">{t('relativeImpact')}: {factor.impact}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mb-0 text-secondary fw-semibold">{t('noKeyFactorsRecorded')}</p>
                )}
              </section>
            </div>

            <div className="col-12 col-lg-7">
              <section className="rounded-4 border bg-white p-4 h-100">
                <h3 className="card-title fw-black mb-3" style={{ color: '#071b49', fontWeight: 900 }}>{t('recommendationsAfterSurgery')}</h3>
                <CarePlanBlock title={t('oxygenotherapy')} items={carePlan.oxygenotherapy} accent="#1265dc" />
                <CarePlanBlock title={t('monitoring')} items={carePlan.monitoring} accent="#16a34a" />
                <CarePlanBlock title={t('disposition')} items={carePlan.disposition} accent="#d97706" />
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CarePlanBlock({ title, items, accent }) {
  return (
    <div className="mb-3 rounded-4 border px-3 py-3">
      <div className="d-flex align-items-center gap-2 mb-2">
        <span className="rounded-circle d-inline-block" style={{ width: 10, height: 10, backgroundColor: accent }} />
        <h4 className="body-text fw-black mb-0" style={{ color: '#071b49', fontWeight: 900 }}>{title}</h4>
      </div>
      <ul className="mb-0 ps-3 text-secondary fw-semibold">
        {items.map((item) => (
          <li key={item} className="mb-1">{item}</li>
        ))}
      </ul>
    </div>
  )
}

function formatDate(value, compact = false) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: compact ? undefined : 'numeric',
    hour: compact ? undefined : '2-digit',
    minute: compact ? undefined : '2-digit',
  })
}

function clinicalNote(prediction) {
  const recommendation = firstRecommendation(prediction, i18n.t.bind(i18n))
  const factor = normalizeFactors(prediction.contributing_factors)[0]?.display
  if (recommendation && factor) return `${recommendation} - key factor: ${factor}`
  return recommendation || factor || 'No recommendation recorded'
}

function firstRecommendation(prediction, t) {
  return prediction.recommendations?.[0] || recommendationByRisk(prediction.risk_level, t).monitoring[0]
}

function normalizeFactors(factors) {
  if (!Array.isArray(factors)) return []
  return factors
    .map((factor) => {
      if (typeof factor === 'string') {
        return { feature: factor, display: factor, impact: '' }
      }
      if (!factor || typeof factor !== 'object') return null
      const display = factor.display || factor.label || factor.name || factor.feature || 'Recorded clinical factor'
      return {
        feature: factor.feature || display,
        display,
        impact: factor.impact ?? factor.weight ?? '',
      }
    })
    .filter(Boolean)
}

function buildCarePlan(prediction, t) {
  const recommendations = Array.isArray(prediction.recommendations) ? prediction.recommendations.filter(Boolean) : []
  const fallback = recommendationByRisk(prediction.risk_level, t)
  const lowerRecommendations = recommendations.map((item) => String(item).toLowerCase())
  const dispositionItems = lowerRecommendations.some((item) => /icu|hdu|ward|bed|disposition/.test(item))
    ? recommendations.filter((item) => /icu|hdu|ward|bed|disposition/i.test(item))
    : fallback.disposition
  const criticalDisposition = t('carePlan.criticalDisposition')

  return {
    oxygenotherapy: recommendations.filter((item) => /oxygen|supplemental|saturation|spo2/i.test(item)).length
      ? recommendations.filter((item) => /oxygen|supplemental|saturation|spo2/i.test(item))
      : fallback.oxygenotherapy,
    monitoring: recommendations.filter((item) => /monitor|repeat|reassess|review|respiratory/i.test(item)).length
      ? recommendations.filter((item) => /monitor|repeat|reassess|review|respiratory/i.test(item))
      : fallback.monitoring,
    disposition: isVeryCriticalPrediction(prediction)
      ? [criticalDisposition, ...dispositionItems.filter((item) => !/icu|hdu|cardiorespiratory/i.test(item))]
      : dispositionItems,
  }
}

function recommendationByRisk(riskLevel, t) {
  const risk = String(riskLevel || '').toLowerCase()
  if (risk.includes('high')) {
    return {
      oxygenotherapy: [t('carePlan.highOxygen')],
      monitoring: [t('carePlan.highMonitoring')],
      disposition: [t('carePlan.highDisposition')],
    }
  }
  if (risk.includes('moderate')) {
    return {
      oxygenotherapy: [t('carePlan.moderateOxygen')],
      monitoring: [t('carePlan.moderateMonitoring')],
      disposition: [t('carePlan.moderateDisposition')],
    }
  }
  return {
    oxygenotherapy: [t('carePlan.lowOxygen')],
    monitoring: [t('carePlan.lowMonitoring')],
    disposition: [t('carePlan.lowDisposition')],
  }
}

function translateRiskLabel(label, t) {
  const normalized = String(label || '').toLowerCase()
  if (normalized.includes('high')) return t('highRisk')
  if (normalized.includes('moderate') || normalized.includes('medium')) return t('moderateRisk')
  if (normalized.includes('low')) return t('lowRisk')
  return t('unknownRisk')
}

function translateFilterOption(option, t) {
  if (option === 'All') return t('all')
  if (option === 'High') return t('highRisk')
  if (option === 'Moderate') return t('moderateRisk')
  if (option === 'Low') return t('lowRisk')
  return option
}

function isVeryCriticalPrediction(prediction) {
  const risk = String(prediction.risk_level || '').toLowerCase()
  const disposition = String(prediction.patient_disposition || '').toLowerCase()
  const factors = normalizeFactors(prediction.contributing_factors)
    .map((factor) => `${factor.feature} ${factor.display}`.toLowerCase())

  return risk.includes('high')
    || disposition.includes('icu')
    || disposition.includes('hdu')
    || factors.some((factor) => factor.includes('asa iv') || factor.includes('asa v'))
    || factors.some((factor) => factor.includes('emergency') && factor.includes('asa iii'))
}

function buildPredictionHistoryReport({ filters, generatedAt, logoDataUrl, predictions, summary, title }) {
  const rows = predictions.map((prediction) => ({
    generated: formatDate(prediction.generated_at),
    patientId: prediction.patient_id || 'Not recorded',
    age: prediction.age || 'Not recorded',
    sex: prediction.sex || 'Not recorded',
    surgery: prediction.surgery_type || 'Not recorded',
    disposition: prediction.patient_disposition || 'Not recorded',
    risk: prediction.risk_level || 'Unknown',
    probability: `${Math.round(Number(prediction.predicted_probability || 0))}%`,
    model: prediction.model_version || 'v1.0',
    clinicalNote: clinicalNote(prediction),
  }))

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} - Prediction History Report</title>
  <style>
    @page { margin: 18mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #071b49;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.45;
      background: #ffffff;
    }
    .report {
      max-width: 1200px;
      margin: 0 auto;
      padding: 28px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 18px;
      border-bottom: 4px solid #84cc16;
      padding-bottom: 18px;
    }
    .logo {
      width: 72px;
      height: 72px;
      object-fit: contain;
      border: 1px solid #d9e5f3;
      border-radius: 12px;
      padding: 6px;
    }
    h1 {
      margin: 0;
      font-size: 24px;
      line-height: 1.2;
    }
    .subtitle {
      margin: 8px 0 0;
      color: #53668a;
      font-size: 14px;
      font-weight: 700;
    }
    .meta, .filters, .summary {
      display: grid;
      gap: 12px;
      margin-top: 20px;
    }
    .meta, .filters {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .summary {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .tile {
      border: 1px solid #d9e5f3;
      border-radius: 10px;
      padding: 12px;
      background: #f8fbff;
    }
    .label {
      color: #64799e;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .value {
      margin-top: 4px;
      color: #071b49;
      font-size: 18px;
      font-weight: 900;
      overflow-wrap: anywhere;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 24px;
      font-size: 12px;
    }
    th {
      background: #eef5ff;
      color: #263957;
      font-size: 11px;
      letter-spacing: 0.05em;
      text-align: left;
      text-transform: uppercase;
    }
    th, td {
      border: 1px solid #d9e5f3;
      padding: 9px;
      vertical-align: top;
    }
    .risk-high { color: #b91c1c; font-weight: 900; }
    .risk-moderate { color: #a16207; font-weight: 900; }
    .risk-low { color: #166534; font-weight: 900; }
    .empty {
      margin-top: 24px;
      border: 1px dashed #cbd8e8;
      border-radius: 10px;
      padding: 18px;
      color: #53668a;
      font-weight: 700;
    }
    .footer {
      margin-top: 28px;
      color: #64799e;
      font-size: 11px;
      text-align: center;
    }
    @media print {
      .report { padding: 0; }
      .tile { break-inside: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <main class="report">
    <header class="header">
      ${logoDataUrl ? `<img class="logo" src="${escapeAttribute(logoDataUrl)}" alt="System logo" />` : ''}
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p class="subtitle">Prediction History Full Report</p>
      </div>
    </header>

    <section class="meta">
      ${reportTile('Generated On', generatedAt.toLocaleString())}
      ${reportTile('Report Scope', 'Filtered prediction history')}
      ${reportTile('Rows Included', summary.filteredTotal)}
    </section>

    <section class="summary">
      ${reportTile('Total Predictions', summary.total)}
      ${reportTile('Filtered Predictions', summary.filteredTotal)}
      ${reportTile('High-Risk Cases', summary.filteredHigh)}
      ${reportTile('Average Probability', `${summary.average}%`)}
    </section>

    <section class="filters">
      ${reportTile('Search Filter', filters.search)}
      ${reportTile('Risk Filter', filters.risk)}
      ${reportTile('Disposition Filter', filters.disposition)}
    </section>

    ${rows.length ? predictionRowsTable(rows) : '<div class="empty">No prediction history matched the selected filters.</div>'}

    <p class="footer">Generated by the postoperative oxygen requirement prediction system.</p>
  </main>
</body>
</html>`
}

function reportTile(label, value) {
  return `
    <div class="tile">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value)}</div>
    </div>
  `
}

function predictionRowsTable(rows) {
  return `
    <table>
      <thead>
        <tr>
          <th>Generated</th>
          <th>Patient ID</th>
          <th>Age</th>
          <th>Sex</th>
          <th>Surgery</th>
          <th>Disposition</th>
          <th>Risk</th>
          <th>Probability</th>
          <th>Model</th>
          <th>Clinical Note</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.generated)}</td>
            <td>${escapeHtml(row.patientId)}</td>
            <td>${escapeHtml(row.age)}</td>
            <td>${escapeHtml(row.sex)}</td>
            <td>${escapeHtml(row.surgery)}</td>
            <td>${escapeHtml(row.disposition)}</td>
            <td class="${riskClass(row.risk)}">${escapeHtml(row.risk)}</td>
            <td>${escapeHtml(row.probability)}</td>
            <td>${escapeHtml(row.model)}</td>
            <td>${escapeHtml(row.clinicalNote)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

function riskClass(risk) {
  const normalized = String(risk || '').toLowerCase()
  if (normalized.includes('high')) return 'risk-high'
  if (normalized.includes('moderate') || normalized.includes('medium')) return 'risk-moderate'
  if (normalized.includes('low')) return 'risk-low'
  return ''
}

async function imageToDataUrl(src) {
  try {
    const response = await fetch(src)
    const blob = await response.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#96;')
}
