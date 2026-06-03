import React, { useEffect, useState } from 'react'
import { getSession } from './authSession.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const LONG_TRAINING_SECONDS = 10 * 60
const LONG_TRAINING_CHECKS = [
  'Confirm the selected target column is correct and has more than one class.',
  'Check for very wide categorical columns, free-text fields, or identifier/date columns that should be dropped.',
  'Use Random Forest for the first local test before trying heavier models.',
  'Keep XGBoost estimators and depth moderate for local hardware.',
  'Avoid refreshing or editing backend files while training, because Django dev reload can stop background jobs.',
  'Check the backend log if a small or medium dataset runs longer than 10 minutes.',
]

function notify(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('app-notification', { detail: { message, type } }))
}

function authHeaders(extraHeaders = {}) {
  const session = getSession()
  return {
    Authorization: `Bearer ${session?.token || ''}`,
    'X-User-Email': session?.email || '',
    ...extraHeaders,
  }
}

export default function TrainingPortal() {
  const [file, setFile] = useState(null)
  const [target, setTarget] = useState('')
  const [modelType, setModelType] = useState('random_forest')
  const [jobId, setJobId] = useState(null)
  const [status, setStatus] = useState(null)
  const [models, setModels] = useState([])
  const [activatingId, setActivatingId] = useState(null)
  const [trainingLoading, setTrainingLoading] = useState(false)
  const [trainingNotice, setTrainingNotice] = useState('')
  const [trainingStartedAt, setTrainingStartedAt] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    fetchModels()
  }, [])

  useEffect(() => {
    if (!trainingLoading || !trainingStartedAt) return undefined

    const tick = () => setElapsedSeconds(Math.floor((Date.now() - trainingStartedAt) / 1000))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [trainingLoading, trainingStartedAt])

  async function fetchModels() {
    try {
      const r = await fetch(`${API_URL}/models`, { credentials: 'include', headers: authHeaders() })
      const j = await r.json()
      setModels(Array.isArray(j.models) ? j.models : [])
    } catch (e) {
      console.error(e)
    }
  }

  async function uploadAndStart() {
    if (!file) {
      notify('Choose a dataset file first', 'warning')
      return
    }

    setTrainingLoading(true)
    setTrainingStartedAt(Date.now())
    setElapsedSeconds(0)
    setTrainingNotice('Uploading dataset and starting training...')
    setStatus(null)
    setJobId(null)

    try {
      const fd = new FormData()
      fd.append('file', file)

      const up = await fetch(`${API_URL}/upload-dataset`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
        headers: authHeaders(),
      })
      const upj = await up.json()
      if (!up.ok) {
        throw new Error(upj.error || 'Could not upload dataset')
      }

      const resp = await fetch(`${API_URL}/train`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ dataset_path: upj.dataset_path, target, model_type: modelType }),
      })
      const job = await resp.json()

      if (job.job_id) {
        setJobId(job.job_id)
        setTrainingNotice('Training started. Waiting for completion...')
        pollStatus(job.job_id)
      } else {
        throw new Error(job.error || 'Could not start training')
      }
    } catch (e) {
      console.error(e)
      setTrainingLoading(false)
      setTrainingStartedAt(null)
      const message = e.message || 'Could not start training.'
      setTrainingNotice(message)
      notify(message, 'error')
    }
  }

  async function pollStatus(id) {
    setStatus({ status: 'queued' })
    const iv = setInterval(async () => {
      const r = await fetch(`${API_URL}/train/status/${id}`, { credentials: 'include', headers: authHeaders() })
      const j = await r.json()
      setStatus(j)
      if (j.status === 'completed' || j.status === 'failed') {
        clearInterval(iv)
        setTrainingLoading(false)
        setTrainingStartedAt(null)
        const message =
          j.status === 'completed'
            ? 'Training is done. The new model is available.'
            : `Training failed${j.error ? `: ${j.error}` : '.'}`
        setTrainingNotice(message)
        notify(message, j.status === 'completed' ? 'success' : 'error')
        fetchModels()
      }
    }, 1000)
  }

  async function activateModel(id) {
    setActivatingId(id)
    try {
      const resp = await fetch(`${API_URL}/models/activate`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ id }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        notify(data.error || 'Could not activate model', 'error')
        return
      }
      fetchModels()
    } catch (e) {
      console.error(e)
      notify('Could not activate model', 'error')
    } finally {
      setActivatingId(null)
    }
  }

  return (
    <div className="container-fluid min-w-0 px-0">
      <div className="grid min-w-0 gap-6 xl:grid-cols-[520px_minmax(0,1fr)]">
        <section className="card border-0 shadow-sm rounded-4 min-w-0 rounded-[16px] border border-[#cfe0f2] bg-white p-6">
          <div className="mb-6">
            <p className="text-[14px] font-extrabold uppercase tracking-[0.14em] text-[#1768f2]">Model Management</p>
            <h1 className="mt-2 text-[32px] font-black leading-tight text-[#071b49]">Training Portal</h1>
            <p className="mt-3 text-[17px] leading-7 text-[#53668a]">
              Upload a labeled dataset, train a model, and choose the active model used by new predictions.
            </p>
          </div>

          <section className="mb-6 min-w-0">
            <label className="form-label mb-2 block text-[17px] font-bold text-[#1d2d4f]">Dataset file</label>
            <input
              className="form-control min-h-12 max-w-full text-[17px]"
              type="file"
              accept=".csv,.tsv,.tab,.txt,.json,.jsonl,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files[0])}
            />
            <p className="mt-3 text-[15px] leading-6 text-slate-600">
              Accepted formats: CSV, TSV, TXT, JSON, JSONL, XLS, and XLSX.
            </p>
          </section>

          <section className="mb-6 min-w-0">
            <label className="form-label mb-2 block text-[17px] font-bold text-[#1d2d4f]">Target column</label>
            <input
              className="form-control min-h-12 w-full min-w-0 rounded-[8px] border border-[#cbd8e8] px-3 py-3 text-[17px]"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Optional, defaults to trainer behavior"
            />
          </section>

          <section className="mb-6 min-w-0">
            <label className="form-label mb-2 block text-[17px] font-bold text-[#1d2d4f]">Model type</label>
            <select value={modelType} onChange={(e) => setModelType(e.target.value)} className="form-select min-h-12 w-full rounded-[8px] border border-[#cbd8e8] px-3 py-3 text-[17px]">
              <option value="logistic_regression">Logistic Regression</option>
              <option value="random_forest">Random Forest</option>
              <option value="xgboost">XGBoost</option>
              <option value="lightgbm">LightGBM</option>
              <option value="knn">K-Nearest Neighbors (KNN)</option>
              <option value="svm">Support Vector Machine (SVM)</option>
              <option value="mlp">Multi-Layer Perceptron (MLP)</option>
              <option value="tab_transformer">Tab Transformer (advanced)</option>
              <option value="naive_bayes">Naive Bayes</option>
            </select>
          </section>

          <div className="mb-6 flex flex-col gap-4 sm:flex-row">
            <button
              onClick={uploadAndStart}
              disabled={trainingLoading}
              className="btn btn-dark min-h-14 w-full rounded-[8px] px-6 py-3 text-[17px] font-black text-white disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              {trainingLoading ? 'Training...' : 'Upload and Train'}
            </button>
            <button onClick={fetchModels} disabled={trainingLoading} className="btn btn-outline-secondary min-h-14 w-full rounded-[8px] border px-6 py-3 text-[17px] font-bold disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto">
              Refresh models
            </button>
          </div>

          {trainingNotice && (
            <div
              className={`alert rounded-4 mb-5 p-5 text-[16px] font-semibold leading-6 ${
                trainingNotice.includes('done')
                  ? 'alert-success bg-emerald-100 text-emerald-800'
                  : trainingNotice.includes('failed') || trainingNotice.includes('Could not')
                    ? 'alert-danger bg-red-100 text-red-800'
                    : 'alert-info bg-sky-100 text-sky-800'
              }`}
              role="alert"
            >
              {trainingNotice}
            </div>
          )}

          {jobId && <div className="mb-4 break-all text-[15px] text-slate-600">Active job: {jobId}</div>}
          {trainingLoading && (
            <TrainingElapsed elapsedSeconds={elapsedSeconds} modelType={modelType} />
          )}
          {status && <TrainingStatusSummary status={status} />}

          <section className="mt-6">
            <h2 className="mb-4 text-[22px] font-black text-[#202938]">Available models</h2>
            <ul className="list-group overflow-hidden rounded-[10px] border border-[#d9e5f3]">
              {models.map((model) => (
                <li key={model.id ?? model.path ?? model.name} className="list-group-item border-0 border-b border-[#edf2f8] px-5 py-4 last:border-b-0">
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-[#202938]">
                        {model.name || model.path || `Model ${model.id}`}
                      </span>
                      <span className="badge rounded-pill bg-secondary rounded-full px-2 py-1 text-xs text-slate-700">
                        {model.model_type || 'unknown'}
                      </span>
                      {model.is_active && (
                        <span className="badge rounded-pill bg-success rounded-full px-3 py-2 text-xs font-bold text-emerald-700">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {model.id ? (
                        <>
                          <button
                            onClick={() => activateModel(model.id)}
                            disabled={model.is_active || activatingId === model.id}
                            className="btn btn-outline-primary btn-sm rounded border px-4 py-2 text-[14px] disabled:opacity-50"
                          >
                            {model.is_active ? 'Active' : activatingId === model.id ? 'Activating...' : 'Make active'}
                          </button>
                          <a className="text-sky-600 underline" href={`${API_URL}/models/download?id=${encodeURIComponent(model.id)}`}>
                            Download
                          </a>
                        </>
                      ) : (
                        <span className="text-slate-500">Download unavailable</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </section>

        <TrainingReport status={status} selectedModelType={modelType} latestModel={models.find((model) => model.is_active)} file={file} />
      </div>
    </div>
  )
}

function TrainingElapsed({ elapsedSeconds, modelType }) {
  const isLongRunning = elapsedSeconds >= LONG_TRAINING_SECONDS
  return (
      <div className={`mb-5 rounded-[12px] border px-5 py-4 ${
        isLongRunning ? 'border-[#f59e0b] bg-[#fff7ed] text-[#7c2d12]' : 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e3a8a]'
      }`}>
        <p className="text-[17px] font-black">Elapsed time: {formatDuration(elapsedSeconds)}</p>
        <p className="mt-2 text-[15px] font-semibold leading-6">
          {formatModelType(modelType)} is running. Keep this backend server open while the job completes.
        </p>
      {isLongRunning && <LongTrainingChecklist />}
    </div>
  )
}

function LongTrainingChecklist() {
  return (
      <div className="mt-4 rounded-[10px] border border-[#fdba74] bg-white/70 p-4">
        <p className="text-[14px] font-black uppercase tracking-[0.08em]">If training passes 10 minutes, check:</p>
        <ul className="mt-3 space-y-2 pl-4 text-[15px] font-semibold leading-6">
        {LONG_TRAINING_CHECKS.map((item) => (
          <li key={item} className="list-disc">{item}</li>
        ))}
      </ul>
    </div>
  )
}

function TrainingStatusSummary({ status }) {
  const metrics = status.result?.metrics || {}
  return (
    <div className="rounded-[12px] border border-[#f6d36f] bg-[#fff3cd] px-5 py-4 text-[16px] leading-6 text-[#76520f]">
      <p className="font-bold">Job status: {status.status}</p>
      {metrics.val_accuracy !== undefined && <p>Val accuracy: {formatMetric(metrics.val_accuracy, 'percent')}</p>}
      {(metrics.val_f1_score !== undefined || metrics.f1_score !== undefined) && (
        <p>F1-score: {formatMetric(metrics.val_f1_score ?? metrics.f1_score, 'percent')}</p>
      )}
      {status.error && <p className="font-bold text-[#b91c1c]">Error: {status.error}</p>}
    </div>
  )
}

function TrainingReport({ status, selectedModelType, latestModel, file }) {
  const result = status?.result || {}
  const metrics = result.metrics || {}
  const isComplete = status?.status === 'completed'
  const metricCards = [
    ['Accuracy', metrics.val_accuracy, 'percent'],
    ['F1-score', metrics.val_f1_score ?? metrics.f1_score, 'percent'],
    ['Precision', metrics.val_precision_weighted, 'percent'],
    ['Recall / Sensitivity', metrics.val_recall_weighted, 'percent'],
    ['Specificity', calculateSpecificity(metrics), 'percent'],
    ['AUC Score', metrics.val_roc_auc ?? metrics.val_roc_auc_weighted_ovr, 'decimal'],
  ]
  const details = {
    modelType: result.model_type || latestModel?.model_type || selectedModelType || 'Not selected',
    status: status?.status || 'Not trained',
    activeModel: latestModel?.is_active ? 'Yes' : result.artifact_id ? 'Yes' : 'No',
    trainingDate: status?.updated_at ? formatDate(status.updated_at) : 'Not available',
    dataset: file?.name || datasetNameFromPath(status?.dataset) || 'Not available',
    accuracy: formatMetric(metrics.val_accuracy, 'percent'),
  }

  return (
    <section className="card border-0 shadow-sm rounded-4 min-w-0 rounded-[16px] border border-[#d9e5f3] bg-white p-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-[30px] font-black leading-9 text-[#0b63ce]">
            Training Results Portal
          </h2>
          <p className="mt-2 text-[17px] font-semibold leading-7 text-[#53668a]">
            Model performance summary after the latest training process
          </p>
          {status?.error && <p className="mt-3 text-[16px] font-bold text-[#b91c1c]">Error: {status.error}</p>}
        </div>
        <span className={`w-fit rounded-full px-5 py-3 text-[14px] font-black uppercase ${
          isComplete ? 'bg-[#dcfce7] text-[#166534]' : status?.status === 'failed' ? 'bg-[#fee2e2] text-[#991b1b]' : 'bg-[#eaf2ff] text-[#1768f2]'
        }`}>
          {status?.status || 'Waiting'}
        </span>
      </div>

      {!isComplete ? (
        <div className="mt-7 rounded-[14px] border border-[#d9e5f3] bg-[#f8fbff] px-6 py-10 text-center">
          <p className="text-[22px] font-black text-[#071b49]">No completed training report yet</p>
          <p className="mt-3 text-[17px] font-semibold text-[#53668a]">
            Upload a dataset and train a model to populate this performance dashboard.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-7 grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
            {metricCards.map(([label, value, format]) => (
              <MetricCard key={label} label={label} value={formatMetric(value, format)} rating={metricRating(value)} />
            ))}
          </div>

          <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
            <ModelDetails details={details} result={result} />
            <ConfusionMatrix metrics={metrics} />
          </div>

          <ClinicalInterpretation metrics={metrics} />

          <div className="mt-6 grid gap-5 xl:grid-cols-3">
            <ColumnList title="Numeric features" items={result.numeric_columns} fallbackCount={result.numeric_feature_count} />
            <ColumnList title="Categorical features" items={result.categorical_columns} fallbackCount={result.categorical_feature_count} />
            <ColumnList title="Dropped columns" items={result.dropped_columns} />
          </div>

          <ClassificationReport report={metrics.classification_report} />
          <ModelParameters parameters={result.model_parameters} />
        </>
      )}
    </section>
  )
}

function ReportTile({ label, value, strong = false }) {
  return (
    <div className="min-w-0 rounded-[12px] border border-[#d9e5f3] bg-white px-5 py-4">
      <p className="text-[13px] font-black uppercase tracking-[0.1em] text-[#64799e]">{label}</p>
      <p className={`mt-2 break-words text-[17px] ${strong ? 'font-black text-[#1768f2]' : 'font-extrabold text-[#071b49]'}`}>
        {value}
      </p>
    </div>
  )
}

function MetricCard({ label, rating, value }) {
  return (
    <div className="min-h-[150px] rounded-[12px] border border-[#e5edf7] bg-white px-6 py-6 text-center shadow-[0_8px_24px_rgba(15,35,75,0.08)]">
      <p className="text-[18px] font-black text-[#263957]">{label}</p>
      <p className="mt-4 text-[34px] font-black leading-none text-[#166534]">{value}</p>
      <p className="mt-3 text-[15px] font-black text-[#168246]">{rating}</p>
    </div>
  )
}

function ModelDetails({ details, result }) {
  const rows = [
    ['Model Type', formatModelType(details.modelType)],
    ['Training Status', details.status],
    ['Active Model', details.activeModel],
    ['Training Date', details.trainingDate],
    ['Dataset Used', details.dataset],
    ['Validation Accuracy', details.accuracy],
    ['Feature Count', result.feature_count ?? 'Not available'],
    ['Train / Validation Rows', `${result.training_row_count ?? '-'} / ${result.validation_row_count ?? '-'}`],
  ]

  return (
    <div className="min-w-0 rounded-[12px] border border-[#e5edf7] bg-white p-6 shadow-[0_8px_24px_rgba(15,35,75,0.08)]">
      <h3 className="text-[21px] font-black text-[#0b63ce]">Model Details</h3>
      <div className="mt-5 space-y-4">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[150px_minmax(0,1fr)] gap-4 text-[15px]">
            <span className="font-bold text-[#64799e]">{label}:</span>
            <span className="break-words font-extrabold text-[#24334f]">
              {label === 'Training Status' || label === 'Active Model' ? (
                <span className="rounded-full bg-[#16a34a] px-3 py-2 text-[12px] font-black text-white">
                  {value}
                </span>
              ) : value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ConfusionMatrix({ metrics }) {
  const matrix = metrics.confusion_matrix || []
  const labels = metrics.confusion_matrix_labels || []
  if (!matrix.length) {
    return <ReportTile label="Confusion matrix" value="Not available" />
  }

  return (
    <div className="min-w-0 rounded-[12px] border border-[#e5edf7] bg-white p-6 shadow-[0_8px_24px_rgba(15,35,75,0.08)]">
      <h3 className="text-[21px] font-black text-[#0b63ce]">Confusion Matrix</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full overflow-hidden rounded-[8px] border border-[#d9e5f3] text-left text-[15px]">
          <thead className="bg-[#f8fbff] text-[#263957]">
            <tr>
              <th className="border-r border-[#d9e5f3] px-5 py-4">Actual / Predicted</th>
              {labels.map((label) => <th key={label} className="px-4 py-3">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={labels[rowIndex] || rowIndex} className="border-t border-[#edf2f8]">
                <th className="border-r border-[#d9e5f3] px-5 py-4 font-black text-[#071b49]">{labels[rowIndex] || rowIndex}</th>
                {row.map((value, colIndex) => (
                  <td key={`${rowIndex}-${colIndex}`} className="px-5 py-4 text-center font-extrabold text-[#24334f]">
                    {value}
                    {matrix.length === 2 && (
                      <span className="ml-1 text-[12px] font-bold text-[#64799e]">
                        {matrixCellLabel(rowIndex, colIndex)}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {matrix.length > 0 && (
              <tr className="border-t border-[#d9e5f3] bg-[#f8fbff]">
                <th className="border-r border-[#d9e5f3] px-5 py-4 font-black text-[#071b49]">Total</th>
                {columnTotals(matrix).map((value, index) => (
                  <td key={index} className="px-5 py-4 text-center font-black text-[#071b49]">{value}</td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ClinicalInterpretation({ metrics }) {
  const accuracy = formatMetric(metrics.val_accuracy, 'percent')
  const f1 = formatMetric(metrics.val_f1_score ?? metrics.f1_score, 'percent')
  const recall = formatMetric(metrics.val_recall_weighted, 'percent')

  return (
    <div className="mt-7 rounded-[12px] border border-[#93c5fd] bg-[#eff6ff] px-6 py-5">
      <h3 className="text-[21px] font-black text-[#0b63ce]">Clinical Interpretation</h3>
      <p className="mt-3 text-[16px] font-semibold leading-7 text-[#20365f]">
        The model achieved {accuracy} validation accuracy and an F1-score of {f1}. Recall / sensitivity is {recall}, which should be prioritized because missing patients who require postoperative oxygen may affect patient safety. Use the model predictions along with clinical judgment for decision making.
      </p>
    </div>
  )
}

function ClassificationReport({ report }) {
  if (!report) return <ReportTile label="Classification report" value="Not available" />
  const rows = Object.entries(report).filter(([, value]) => value && typeof value === 'object')

  return (
    <div className="min-w-0 rounded-[12px] border border-[#d9e5f3] bg-white p-5">
      <p className="text-[14px] font-black uppercase tracking-[0.1em] text-[#64799e]">Class performance</p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-[15px]">
          <thead className="text-[#53668a]">
            <tr>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Precision</th>
              <th className="px-4 py-3">Recall</th>
              <th className="px-4 py-3">F1</th>
              <th className="px-4 py-3">Support</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-t border-[#edf2f8]">
                <th className="px-4 py-3 font-black text-[#071b49]">{label}</th>
                <td className="px-4 py-3">{formatMetric(value.precision, 'percent')}</td>
                <td className="px-4 py-3">{formatMetric(value.recall, 'percent')}</td>
                <td className="px-4 py-3">{formatMetric(value['f1-score'], 'percent')}</td>
                <td className="px-4 py-3">{value.support ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ColumnList({ title, items, fallbackCount }) {
  const columns = Array.isArray(items) ? items : []
  return (
    <div className="min-w-0 rounded-[12px] border border-[#d9e5f3] bg-white p-5">
      <p className="text-[14px] font-black uppercase tracking-[0.1em] text-[#64799e]">{title}</p>
      <p className="mt-2 text-[16px] font-extrabold text-[#071b49]">
        {columns.length || fallbackCount || 0} columns
      </p>
      <div className="mt-4 flex max-h-[190px] flex-wrap gap-2 overflow-y-auto pr-1">
        {columns.length > 0 ? columns.map((item) => (
          <span key={item} className="rounded-full bg-[#eaf2ff] px-3 py-2 text-[13px] font-bold text-[#071b49]">
            {item}
          </span>
        )) : (
          <span className="text-[15px] font-semibold text-[#64799e]">No columns reported.</span>
        )}
      </div>
    </div>
  )
}

function ModelParameters({ parameters }) {
  const entries = Object.entries(parameters || {})
    .filter(([, value]) => value !== undefined && value !== null && typeof value !== 'object')
    .slice(0, 36)

  if (!entries.length) return null

  return (
    <div className="mt-6 min-w-0 rounded-[12px] border border-[#d9e5f3] bg-white p-5">
      <p className="text-[14px] font-black uppercase tracking-[0.1em] text-[#64799e]">Model parameters</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {entries.map(([key, value]) => (
          <div key={key} className="min-w-0 rounded-[10px] bg-[#f8fbff] px-4 py-3">
            <p className="truncate text-[12px] font-black uppercase text-[#64799e]" title={key}>{key}</p>
            <p className="mt-1 truncate text-[15px] font-extrabold text-[#071b49]" title={String(value)}>{String(value)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatMetric(value, format = 'decimal') {
  const number = Number(value)
  if (!Number.isFinite(number)) return 'Not available'
  if (format === 'percent') return `${(number * 100).toFixed(2)}%`
  return number.toFixed(4)
}

function formatPercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 'Not available'
  return `${(number * 100).toFixed(0)}%`
}

function calculateSpecificity(metrics) {
  const matrix = metrics.confusion_matrix || []
  if (matrix.length !== 2 || matrix[0].length !== 2 || matrix[1].length !== 2) return null
  const trueNegative = Number(matrix[0][0])
  const falsePositive = Number(matrix[0][1])
  const denominator = trueNegative + falsePositive
  return denominator > 0 ? trueNegative / denominator : null
}

function metricRating(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 'Pending'
  if (number >= 0.85) return 'Very Good'
  if (number >= 0.7) return 'Good'
  if (number >= 0.55) return 'Fair'
  return 'Needs Review'
}

function matrixCellLabel(rowIndex, colIndex) {
  if (rowIndex === 0 && colIndex === 0) return '(TN)'
  if (rowIndex === 0 && colIndex === 1) return '(FP)'
  if (rowIndex === 1 && colIndex === 0) return '(FN)'
  if (rowIndex === 1 && colIndex === 1) return '(TP)'
  return ''
}

function columnTotals(matrix) {
  const maxColumns = Math.max(...matrix.map((row) => row.length))
  return Array.from({ length: maxColumns }).map((_, columnIndex) => (
    matrix.reduce((sum, row) => sum + Number(row[columnIndex] || 0), 0)
  ))
}

function formatDate(value) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes <= 0) return `${seconds}s`
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

function datasetNameFromPath(path) {
  if (!path) return ''
  return String(path).split(/[\\/]/).pop() || ''
}

function formatModelType(value) {
  return String(value || 'Not selected')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
