import React, { useEffect, useMemo, useState } from 'react'
import { PREDICTION_HISTORY_UPDATED_EVENT } from '../predictionEvents.js'
import { API_BASE_URL } from '../config/api.js'

const pageSizes = [10, 25, 50, 100]

export default function PredictionHistoryContent() {
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

  function downloadHistory() {
    const rows = filteredPredictions.map((prediction) => ({
      generated: formatDate(prediction.generated_at),
      patient_id: prediction.patient_id || '',
      age: prediction.age || '',
      sex: prediction.sex || '',
      surgery_type: prediction.surgery_type || '',
      patient_disposition: prediction.patient_disposition || '',
      risk_level: prediction.risk_level || '',
      probability: `${Math.round(Number(prediction.predicted_probability || 0))}%`,
      model_version: prediction.model_version || '',
      clinical_note: clinicalNote(prediction),
    }))

    const csv = toCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `prediction-history-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setExportOpen(false)
  }

  function shareByEmail() {
    const subject = 'Postoperative oxygen prediction history'
    const body = [
      `Prediction history export`,
      `Total records: ${filteredPredictions.length}`,
      `High-risk cases: ${filteredPredictions.filter((prediction) => prediction.risk_level === 'High').length}`,
      '',
      'Open the system to review or download the full filtered history.',
    ].join('\n')

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    setExportOpen(false)
  }

  return (
    <div className="container-fluid px-0">
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-4">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-xl">
              <div className="small-text text-primary fw-bold text-uppercase mb-2" style={{ letterSpacing: '0.14em' }}>
                Prediction History
              </div>
              <h1 className="page-title fw-black mb-2" style={{ color: '#071b49', fontWeight: 900 }}>
                Oxygen risk prediction log
              </h1>
              <p className="body-text mb-0 text-secondary">
                Review generated predictions, patient disposition, model version, and clinical follow-up notes.
              </p>
            </div>
            <div className="col-12 col-xl-auto position-relative">
              <button
                className="btn btn-dark rounded-pill fw-bold px-4 py-2 w-100 w-xl-auto"
                type="button"
                onClick={() => setExportOpen((open) => !open)}
                aria-expanded={exportOpen}
              >
                Export history
              </button>
              {exportOpen && (
                <div
                  className="position-absolute end-0 mt-2 rounded-4 bg-white shadow border p-2"
                  style={{ zIndex: 20, minWidth: 240 }}
                >
                  <button
                    className="btn btn-success rounded-4 fw-bold w-100 mb-2 py-2"
                    type="button"
                    onClick={downloadHistory}
                  >
                    Download CSV
                  </button>
                  <button
                    className="btn btn-warning rounded-4 fw-bold w-100 py-2"
                    type="button"
                    onClick={shareByEmail}
                  >
                    Share by email
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <SummaryCard label="Total predictions" value={summary.total} accent="#1265dc" />
        <SummaryCard label="High-risk cases" value={summary.high} accent="#ef4444" />
        <SummaryCard label="Average probability" value={`${summary.average}%`} accent="#facc15" />
        <SummaryCard label="Latest generated" value={summary.latest ? formatDate(summary.latest, true) : 'None'} accent="#22c55e" />
      </div>

      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-4">
          <div className="row g-3">
            <div className="col-12 col-xl-5">
              <label className="form-label fw-bold text-secondary">Search</label>
              <input
                className="form-control form-control-lg rounded-4"
                placeholder="Search by patient ID, surgery, model"
                value={search}
                onChange={(event) => updateFilter(setSearch, event.target.value)}
              />
            </div>
            <div className="col-12 col-md-4 col-xl">
              <FilterSelect label="Risk" value={riskFilter} onChange={(value) => updateFilter(setRiskFilter, value)} options={['All', 'High', 'Moderate', 'Low']} />
            </div>
            <div className="col-12 col-md-4 col-xl">
              <FilterSelect label="Disposition" value={dispositionFilter} onChange={(value) => updateFilter(setDispositionFilter, value)} options={['All', 'OPD', 'Ward', 'HDU', 'ICU']} />
            </div>
            <div className="col-12 col-md-4 col-xl">
              <FilterSelect label="Table size" value={String(pageSize)} onChange={(value) => {
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
                <th className="px-4 py-3">Generated</th>
                <th className="px-4 py-3">Patient ID</th>
                <th className="px-4 py-3">Surgery</th>
                <th className="px-4 py-3">Disposition</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Probability</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Clinical note</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-secondary fw-semibold" colSpan="8">Loading prediction history...</td>
                </tr>
              ) : visiblePredictions.length > 0 ? (
                visiblePredictions.map((prediction) => (
                  <tr key={prediction.id}>
                    <td className="table-body px-4 py-3 fw-semibold text-nowrap">{formatDate(prediction.generated_at)}</td>
                    <td className="table-body px-4 py-3 fw-bold" style={{ color: '#071b49' }}>{prediction.patient_id}</td>
                    <td className="table-body px-4 py-3">{prediction.surgery_type || 'Not recorded'}</td>
                    <td className="table-body px-4 py-3">{prediction.patient_disposition || 'Not recorded'}</td>
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
                  <td className="px-4 py-4 text-secondary fw-semibold" colSpan="8">No prediction history found.</td>
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
                      Previous
                    </button>
                  </li>
                  <li className="page-item active">
                    <span className="page-link">
                      {currentPage} / {totalPages}
                    </span>
                  </li>
                  <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button className="page-link rounded-end-pill" onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                      Next
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
  return (
    <>
      <label className="form-label fw-bold text-secondary">{label}</label>
      <select
        className="form-select form-select-lg rounded-4"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </>
  )
}

function RiskBadge({ risk }) {
  const cls = risk === 'High'
    ? 'text-bg-danger'
    : risk === 'Moderate'
      ? 'text-bg-warning'
      : 'text-bg-success'

  return (
    <span className={`badge rounded-pill px-3 py-2 ${cls}`}>
      {risk || 'Unknown'}
    </span>
  )
}

function ClinicalNote({ prediction, onOpen }) {
  const recommendation = firstRecommendation(prediction)
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
        View key factors and care plan
        <span aria-hidden="true">&rsaquo;</span>
      </button>
      {factors.length > 0 && (
        <span className="small text-secondary">
          Key factor: {factors[0].display}
        </span>
      )}
    </div>
  )
}

function PredictionDetailModal({ prediction, onClose }) {
  const probability = Math.round(Number(prediction.predicted_probability || 0))
  const factors = normalizeFactors(prediction.contributing_factors)
  const carePlan = buildCarePlan(prediction)

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
                Prediction guidance
              </div>
              <h2 id="prediction-detail-title" className="fw-black mb-2" style={{ color: '#071b49', fontWeight: 900 }}>
                {prediction.patient_id || 'Patient'} postoperative oxygen plan
              </h2>
              <p className="mb-0 text-secondary fw-semibold">
                {prediction.risk_level || 'Unknown'} risk, {probability}% probability, {prediction.patient_disposition || 'Ward'} disposition
              </p>
            </div>
            <button type="button" className="btn btn-light rounded-circle fw-bold align-self-start" onClick={onClose} aria-label="Close details">
              &times;
            </button>
          </div>

          <div className="row g-3 mt-3">
            <div className="col-12 col-lg-5">
              <section className="rounded-4 border bg-white p-4 h-100">
                <h3 className="card-title fw-black mb-3" style={{ color: '#071b49', fontWeight: 900 }}>Key factors that led to prediction</h3>
                {factors.length > 0 ? (
                  <div className="d-flex flex-column gap-2">
                    {factors.map((factor, index) => (
                      <div key={`${factor.feature}-${index}`} className="rounded-4 border bg-light px-3 py-3">
                        <p className="mb-1 fw-bold" style={{ color: '#071b49' }}>{index + 1}. {factor.display}</p>
                        {factor.impact && (
                          <p className="small-text mb-0 text-secondary">Relative impact: {factor.impact}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mb-0 text-secondary fw-semibold">No key factors were recorded for this prediction.</p>
                )}
              </section>
            </div>

            <div className="col-12 col-lg-7">
              <section className="rounded-4 border bg-white p-4 h-100">
                <h3 className="card-title fw-black mb-3" style={{ color: '#071b49', fontWeight: 900 }}>Recommendations after surgery</h3>
                <CarePlanBlock title="Oxygenotherapy" items={carePlan.oxygenotherapy} accent="#1265dc" />
                <CarePlanBlock title="Monitoring" items={carePlan.monitoring} accent="#16a34a" />
                <CarePlanBlock title="Disposition" items={carePlan.disposition} accent="#d97706" />
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
  const recommendation = firstRecommendation(prediction)
  const factor = normalizeFactors(prediction.contributing_factors)[0]?.display
  if (recommendation && factor) return `${recommendation} - key factor: ${factor}`
  return recommendation || factor || 'No recommendation recorded'
}

function firstRecommendation(prediction) {
  return prediction.recommendations?.[0] || recommendationByRisk(prediction.risk_level).monitoring[0]
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

function buildCarePlan(prediction) {
  const recommendations = Array.isArray(prediction.recommendations) ? prediction.recommendations.filter(Boolean) : []
  const fallback = recommendationByRisk(prediction.risk_level)
  const lowerRecommendations = recommendations.map((item) => String(item).toLowerCase())
  const dispositionItems = lowerRecommendations.some((item) => /icu|hdu|ward|bed|disposition/.test(item))
    ? recommendations.filter((item) => /icu|hdu|ward|bed|disposition/i.test(item))
    : fallback.disposition
  const criticalDisposition = 'Book ICU or HDU care when available for cardiorespiratory support, close observation, and rapid escalation after surgery.'

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

function recommendationByRisk(riskLevel) {
  const risk = String(riskLevel || '').toLowerCase()
  if (risk.includes('high')) {
    return {
      oxygenotherapy: ['Prepare supplemental oxygen immediately and titrate to the patient target saturation.'],
      monitoring: ['Use close PACU or HDU monitoring with frequent SpO2 and respiratory-rate reassessment.'],
      disposition: ['Book ICU or HDU care for cardiorespiratory support and arrange early senior clinician review.'],
    }
  }
  if (risk.includes('moderate')) {
    return {
      oxygenotherapy: ['Keep oxygen equipment ready and start oxygen if SpO2 falls or respiratory work increases.'],
      monitoring: ['Repeat SpO2 assessment and reassess respiratory status during early recovery.'],
      disposition: ['Use HDU or enhanced ward observation according to clinical status and local protocol.'],
    }
  }
  return {
    oxygenotherapy: ['Oxygen only if clinically indicated by saturation or respiratory status.'],
    monitoring: ['Continue routine postoperative monitoring and reassess if condition changes.'],
    disposition: ['Ward disposition is appropriate if recovery observations remain stable.'],
  }
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

function toCsv(rows) {
  if (!rows.length) return 'generated,patient_id,age,sex,surgery_type,patient_disposition,risk_level,probability,model_version,clinical_note\n'
  const headers = Object.keys(rows[0])
  const lines = rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))
  return `${headers.join(',')}\n${lines.join('\n')}\n`
}

function csvCell(value) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}
