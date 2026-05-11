import React, { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function TrainingPortal() {
  const [file, setFile] = useState(null)
  const [target, setTarget] = useState('')
  const [modelType, setModelType] = useState('random_forest')
  const [jobId, setJobId] = useState(null)
  const [status, setStatus] = useState(null)
  const [models, setModels] = useState([])

  useEffect(() => {
    fetchModels()
  }, [])

  async function fetchModels() {
    try {
      const r = await fetch(`${API_URL}/models`)
      const j = await r.json()
      setModels(j.models || [])
    } catch (e) {
      console.error(e)
    }
  }

  async function uploadAndStart() {
    if (!file) return alert('Choose a CSV file first')
    const fd = new FormData()
    fd.append('file', file)
    const up = await fetch(`${API_URL}/upload-dataset`, { method: 'POST', body: fd })
    const upj = await up.json()
    const resp = await fetch(`${API_URL}/train`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataset_path: upj.dataset_path, target, model_type: modelType }) })
    const job = await resp.json()
    if (job.job_id) {
      setJobId(job.job_id)
      pollStatus(job.job_id)
    } else if (job.error) {
      alert(job.error)
    }
  }

  async function pollStatus(id) {
    setStatus({ status: 'queued' })
    const iv = setInterval(async () => {
      const r = await fetch(`${API_URL}/train/status/${id}`)
      const j = await r.json()
      setStatus(j)
      if (j.status === 'completed' || j.status === 'failed') {
        clearInterval(iv)
        fetchModels()
      }
    }, 1500)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Training Portal</h1>

      <section className="mb-6">
        <label className="block mb-2">Dataset (CSV)</label>
        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} />
      </section>

      <section className="mb-6">
        <label className="block mb-2">Target column (optional — defaults to last column)</label>
        <input className="border p-2 w-full" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="target_column" />
      </section>

      <section className="mb-6">
        <label className="block mb-2">Model type</label>
        <select value={modelType} onChange={(e) => setModelType(e.target.value)} className="border p-2">
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

      <div className="flex gap-3 mb-6">
        <button onClick={uploadAndStart} className="px-4 py-2 bg-slate-900 text-white rounded">Upload & Train</button>
        <button onClick={fetchModels} className="px-4 py-2 border rounded">Refresh models</button>
      </div>

      {status && (
        <div className="mb-4 p-4 bg-amber-50 rounded">
          <div>Job status: {status.status}</div>
          {status.result && status.result.metrics && <div>Val accuracy: {status.result.metrics.val_accuracy}</div>}
          {status.error && <div className="text-red-600">Error: {status.error}</div>}
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-2">Available models</h2>
        <ul className="list-disc pl-6">
          {models.map((m) => (
            <li key={m} className="mb-2">
              <span className="mr-3 truncate" style={{ maxWidth: 420, display: 'inline-block' }}>{m}</span>
              <a className="text-sky-600 underline" href={`${API_URL}/models/download?path=${encodeURIComponent(m)}`}>Download</a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
