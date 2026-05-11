import React, { useState } from 'react'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function PostoperativeOxygenMLUIMockup() {
  const [probability, setProbability] = useState(0.82)
  const [riskLabel, setRiskLabel] = useState(probability >= 0.5 ? 'High risk' : 'Low risk')
  const [factorChips, setFactorChips] = useState([
    'Post-op SpO₂: 90%',
    'ASA III',
    'Emergency surgery',
    'Operative time: 210 min',
    'BMI: 31.2',
    'Residual opioid effect',
  ])

  const [recommendations, setRecommendations] = useState([
    'Start close oxygen monitoring immediately.',
    'Prepare supplemental oxygen in PACU/ward.',
    'Repeat SpO₂ and respiratory rate within 15 minutes.',
    'Escalate review if oxygen saturation remains below target.',
  ])

  const predictors = [
    ['Age', '62 years'],
    ['Sex', 'Female'],
    ['BMI', '31.2 kg/m²'],
    ['Comorbidities', 'Hypertension, asthma'],
    ['Smoking history', 'No'],
    ['Baseline SpO₂', '95%'],
    ['Surgery type', 'Abdominal surgery'],
    ['Urgency', 'Emergency'],
    ['Duration of surgery', '210 min'],
    ['Anesthesia type', 'General anesthesia'],
    ['Residual anesthetic effects', 'Present'],
    ['Opioid use', 'Yes'],
    ['Post-op SpO₂', '90%'],
    ['Respiratory rate', '26 breaths/min'],
    ['Pain status', 'Severe'],
    ['Level of consciousness', 'Drowsy'],
  ]

  const metricCards = [
    ['AUC', '0.84'],
    ['Sensitivity', '0.81'],
    ['Specificity', '0.76'],
    ['F1-score', '0.78'],
  ]

  const [loading, setLoading] = useState(false)

  // Mock prediction call - replace with real API integration
  async function mockPredict() {
    // Try calling the Python backend first (FastAPI)
    try {
      const resp = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: { post_op_spo2: 90 }, model_type: 'xgboost' }),
      })
      if (resp.ok) return await resp.json()
    } catch (e) {
      // ignore and fall back to local simulation
    }

    // Fallback simulated response
    await new Promise((r) => setTimeout(r, 400))
    const postOpSpO2 = 90
    let prob = 0.82
    if (postOpSpO2 < 92) prob += 0.08
    if (postOpSpO2 < 88) prob += 0.05
    prob = Math.min(0.98, prob)

    return {
      probability: prob,
      factors: [
        `Post-op SpO₂: ${postOpSpO2}%`,
        'Residual anesthetic effects',
        'Prolonged operative time',
      ],
      recommendations: [
        'Apply supplemental oxygen and monitor SpO₂ closely.',
        'Repeat observations in 15 minutes.',
      ],
    }
  }

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await mockPredict()
      setProbability(res.probability)
      setFactorChips(res.factors)
      setRecommendations(res.recommendations)
      setRiskLabel(res.probability >= 0.5 ? 'High risk' : 'Low risk')
    } finally {
      setLoading(false)
    }
  }

  // Training UI: upload CSV and start training
  const [trainFile, setTrainFile] = useState(null)
  const [trainJob, setTrainJob] = useState(null)
  const [trainStatus, setTrainStatus] = useState(null)
  const [models, setModels] = useState([])

  async function uploadAndTrain() {
    if (!trainFile) return
    const fd = new FormData()
    fd.append('file', trainFile)
    try {
      const up = await fetch(`${API_URL}/upload-dataset`, { method: 'POST', body: fd })
      const data = await up.json()
      const resp = await fetch(`${API_URL}/train`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataset_path: data.dataset_path }) })
      const job = await resp.json()
      setTrainJob(job.job_id)
      setTrainStatus({ status: 'queued' })
      // poll status
      const iv = setInterval(async () => {
        const s = await fetch(`${API_URL}/train/status/${job.job_id}`)
        const sj = await s.json()
        setTrainStatus(sj)
        if (sj.status === 'completed' || sj.status === 'failed') {
          clearInterval(iv)
          // refresh models list
          const m = await fetch(`${API_URL}/models`)
          setModels((await m.json()).models || [])
        }
      }, 1500)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">
                Kibagabaga Level Two Teaching Hospital
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">
                Postoperative Oxygen Requirement Prediction Tool
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Django-based clinical decision support interface for early identification of surgical patients likely to require postoperative oxygen therapy.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm md:w-[340px]">
              <div className="rounded-2xl bg-slate-100 p-4">
                <p className="text-slate-500">Model</p>
                <p className="mt-1 font-semibold text-slate-900">XGBoost</p>
              </div>
              <div className="rounded-2xl bg-slate-100 p-4">
                <p className="text-slate-500">Outcome</p>
                <p className="mt-1 font-semibold text-slate-900">Oxygen: Yes / No</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Patient and Perioperative Inputs</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Structured fields based on patient-related, surgery-related, anesthesia-related, and immediate postoperative clinical predictors.
                  </p>
                </div>
                <button className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:scale-[1.01]">
                  Auto-fill from EMR
                </button>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 p-5">
                  <h3 className="text-base font-semibold text-slate-900">Patient-related factors</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Patient ID" value="KBH-SUR-2026-00128" />
                    <Field label="Age" value="62" />
                    <Field label="Sex" value="Female" />
                    <Field label="BMI" value="31.2" />
                    <Field label="Comorbidities" value="HTN, Asthma" className="sm:col-span-2" />
                    <Field label="Smoking history" value="No" />
                    <Field label="Baseline SpO₂" value="95%" />
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-5">
                  <h3 className="text-base font-semibold text-slate-900">Surgery-related factors</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Type of surgery" value="Abdominal" className="sm:col-span-2" />
                    <Field label="Urgency" value="Emergency" />
                    <Field label="Duration" value="210 min" />
                    <Field label="Estimated blood loss" value="Moderate" />
                    <Field label="Perioperative anemia" value="Possible" />
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-5">
                  <h3 className="text-base font-semibold text-slate-900">Anesthesia-related factors</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Anesthesia type" value="General" />
                    <Field label="ASA class" value="III" />
                    <Field label="Residual anesthetic effects" value="Present" className="sm:col-span-2" />
                    <Field label="Opioid use" value="Yes" />
                    <Field label="Airway event" value="None" />
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-5">
                  <h3 className="text-base font-semibold text-slate-900">Immediate postoperative factors</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Post-op SpO₂" value="90%" />
                    <Field label="Respiratory rate" value="26/min" />
                    <Field label="Pain status" value="Severe" />
                    <Field label="Consciousness" value="Drowsy" />
                    <Field label="PACU/ward" value="PACU" />
                    <Field label="Time since surgery" value="30 min" />
                  </div>
                </section>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:scale-[1.01] disabled:opacity-60"
                >
                  {loading ? 'Generating...' : 'Generate prediction'}
                </button>
                <div className="ml-4 flex items-center gap-3">
                  <input type="file" accept=".csv" onChange={(e) => setTrainFile(e.target.files[0])} />
                  <button onClick={uploadAndTrain} className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700">Train model</button>
                </div>
                <button className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  Clear form
                </button>
                <button className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  Save to EMR
                </button>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Entered predictor summary</h2>
              {trainStatus && (
                <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
                  Training job status: {trainStatus.status}
                  {trainStatus.result && <div>Val accuracy: {trainStatus.result.metrics?.val_accuracy}</div>}
                  {trainStatus.error && <div className="text-red-600">Error: {trainStatus.error}</div>}
                </div>
              )}
              {models.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium">Available models</p>
                  <ul className="mt-2 text-sm">
                    {models.map((m) => (
                      <li key={m} className="truncate">{m}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {predictors.map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl bg-gradient-to-br from-sky-700 to-cyan-600 p-6 text-white shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-sky-100">Prediction result</p>
              <div className="mt-4 flex items-end gap-4">
                <div>
                  <p className="text-5xl font-bold">{Math.round(probability * 100)}%</p>
                  <p className="mt-1 text-sm text-sky-100">Predicted probability of postoperative oxygen requirement</p>
                </div>
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium">
                  {riskLabel}
                </span>
              </div>
              <div className="mt-6 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm leading-6 text-sky-50">
                  The model predicts that this patient is likely to require supplemental oxygen in the immediate postoperative period.
                </p>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Why the model flagged this patient</h2>
              <p className="mt-1 text-sm text-slate-600">
                Explainable output using SHAP-style contributing factors.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {factorChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Suggested clinical action</h2>
              <div className="mt-4 space-y-3">
                {recommendations.map((item, index) => (
                  <div key={item} className="flex gap-3 rounded-2xl bg-slate-50 p-4">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                      {index + 1}
                    </div>
                    <p className="text-sm text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                This tool supports clinical decision-making. Final oxygen therapy decisions remain with the clinician.
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Model performance panel</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {metricCards.map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Decision threshold</span>
                  <span className="font-medium text-slate-900">0.50</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100">
                  <div className="h-3 w-[50%] rounded-full bg-slate-900" />
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Usability and workflow design</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <p>• Simple layout for doctors and anesthetists in PACU and postoperative wards.</p>
                <p>• Easy data entry, clear result wording, and explanation panel to support acceptance.</p>
                <p>• Designed for integration with the existing EMR as a clinical decision support tool.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">
        {value}
      </div>
    </div>
  );
}
