import React, { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function notify(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('app-notification', { detail: { message, type } }))
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

  useEffect(() => {
    fetchModels()
  }, [])

  async function fetchModels() {
    try {
      const r = await fetch(`${API_URL}/models`, { credentials: 'include' })
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
    setTrainingNotice('Uploading dataset and starting training...')
    setStatus(null)
    setJobId(null)

    try {
      const fd = new FormData()
      fd.append('file', file)

      const up = await fetch(`${API_URL}/upload-dataset`, { method: 'POST', body: fd, credentials: 'include' })
      const upj = await up.json()
      if (!up.ok) {
        throw new Error(upj.error || 'Could not upload dataset')
      }

      const resp = await fetch(`${API_URL}/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const message = e.message || 'Could not start training.'
      setTrainingNotice(message)
      notify(message, 'error')
    }
  }

  async function pollStatus(id) {
    setStatus({ status: 'queued' })
    const iv = setInterval(async () => {
      const r = await fetch(`${API_URL}/train/status/${id}`, { credentials: 'include' })
      const j = await r.json()
      setStatus(j)
      if (j.status === 'completed' || j.status === 'failed') {
        clearInterval(iv)
        setTrainingLoading(false)
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
        headers: { 'Content-Type': 'application/json' },
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
      <div className="card border-0 shadow-sm rounded-4 mb-3 rounded-[16px] border border-[#cfe0f2] bg-white p-6">
        <div className="mb-5">
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#1768f2]">Model Management</p>
          <h1 className="mt-2 text-[30px] font-black leading-tight text-[#071b49] md:text-[38px]">Training Portal</h1>
          <p className="mt-2 max-w-[720px] text-[16px] leading-7 text-[#53668a]">
            Upload a labeled dataset, train a prediction model, and choose the active model used by new predictions.
          </p>
        </div>
        

        <section className="mb-6 min-w-0">
          <label className="form-label mb-2 block">Dataset file</label>
          <input
            className="form-control max-w-full text-[15px]"
            type="file"
            accept=".csv,.tsv,.tab,.txt,.json,.jsonl,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files[0])}
          />
          <p className="mt-2 text-sm text-slate-600">
            Accepted formats: CSV, TSV, TXT, JSON, JSONL, XLS, and XLSX.
          </p>
        </section>

        <section className="mb-6 min-w-0">
          <label className="form-label mb-2 block">Target column (optional, defaults to trainer behavior)</label>
          <input
            className="form-control w-full min-w-0 border p-2"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="target_column"
          />
        </section>

        <section className="mb-6 min-w-0">
          <label className="form-label mb-2 block">Model type</label>
          <select value={modelType} onChange={(e) => setModelType(e.target.value)} className="form-select w-full max-w-[410px] border p-2">
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

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={uploadAndStart}
            disabled={trainingLoading}
            className="btn btn-dark w-full rounded px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            {trainingLoading ? 'Training...' : 'Upload and Train'}
          </button>
          <button onClick={fetchModels} disabled={trainingLoading} className="btn btn-outline-secondary w-full rounded border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto">
            Refresh models
          </button>
        </div>

        {trainingNotice && (
          <div
            className={`alert rounded-4 mb-4 p-4 font-semibold ${
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

        {jobId && <div className="mb-3 text-sm text-slate-600">Active job: {jobId}</div>}

        {status && (
          <div className="alert alert-warning rounded-4 mb-4 bg-amber-50 p-4">
            <div>Job status: {status.status}</div>
            {status.result && status.result.metrics && <div>Val accuracy: {status.result.metrics.val_accuracy}</div>}
            {status.error && <div className="text-red-600">Error: {status.error}</div>}
          </div>
        )}

        <section>
          <h2 className="mb-2 text-lg font-semibold">Available models</h2>
          <ul className="list-group">
            {models.map((model) => (
              <li key={model.id ?? model.path ?? model.name} className="list-group-item mb-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-block truncate font-medium" style={{ maxWidth: 420 }}>
                    {model.name || model.path || `Model ${model.id}`}
                  </span>
                  <span className="badge rounded-pill bg-secondary rounded-full px-2 py-1 text-xs text-slate-700">
                    {model.model_type || 'unknown'}
                  </span>
                  {model.is_active && (
                    <span className="badge rounded-pill bg-success rounded-full px-2 py-1 text-xs font-medium text-emerald-700">
                      Active
                    </span>
                  )}
                  {model.id ? (
                    <>
                      <button
                        onClick={() => activateModel(model.id)}
                        disabled={model.is_active || activatingId === model.id}
                        className="btn btn-outline-primary btn-sm rounded border px-3 py-1 text-sm disabled:opacity-50"
                      >
                        {model.is_active ? 'Active' : activatingId === model.id ? 'Activating...' : 'Make active'}
                      </button>
                      <a
                        className="text-sky-600 underline"
                        href={`${API_URL}/models/download?id=${encodeURIComponent(model.id)}`}
                      >
                        Download
                      </a>
                    </>
                  ) : (
                    <span className="text-slate-500">Download unavailable</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
