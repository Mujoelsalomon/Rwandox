import React, { useMemo, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const initialForm = {
  hospitalId: 'KBH-2026-00128',
  age: '62',
  sex: 'Female',
  height: '165',
  weight: '85',
  smokingHistory: 'No',
  baselineSpo2: '95',
  surgeryType: 'Abdominal',
  urgency: 'Emergency',
  duration: '210',
  bloodLoss: 'Moderate',
  patientDisposition: 'Ward',
  procedureDate: '2026-04-21',
}

export default function NewPredictionContent() {
  const [mode, setMode] = useState('new')
  const [form, setForm] = useState(initialForm)
  const [datasetName, setDatasetName] = useState('')
  const [targetColumn, setTargetColumn] = useState('')
  const [modelType, setModelType] = useState('xgboost')
  const [datasetFile, setDatasetFile] = useState(null)
  const [existingSearch, setExistingSearch] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState('')

  const bmi = useMemo(() => {
    const heightM = Number(form.height) / 100
    const weightKg = Number(form.weight)
    if (!heightM || !weightKg) return ''
    return (weightKg / (heightM * heightM)).toFixed(1)
  }, [form.height, form.weight])

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function applyPatient(patient) {
    const record = patient.latest_record || {}
    setForm((current) => ({
      ...current,
      hospitalId: patient.hospital_id || current.hospitalId,
      age: patient.age ? String(patient.age) : current.age,
      sex: patient.sex || current.sex,
      smokingHistory: patient.smoking_history ? 'Yes' : 'No',
      baselineSpo2: patient.baseline_spo2 ? String(patient.baseline_spo2) : current.baselineSpo2,
      surgeryType: record.surgery_type || current.surgeryType,
      urgency: record.urgency ? capitalize(record.urgency) : current.urgency,
      duration: record.surgery_duration ? String(record.surgery_duration) : current.duration,
      bloodLoss: record.blood_loss || current.bloodLoss,
      patientDisposition: record.ward || current.patientDisposition,
      procedureDate: record.procedure_date || current.procedureDate,
    }))
  }

  async function loadExistingPatient() {
    setLoading(true)
    setStatusMessage('')
    try {
      const resp = await fetch(`${API_URL}/patients/search?q=${encodeURIComponent(existingSearch)}`)
      const data = await resp.json()
      const patient = data.patients?.[0]
      if (!resp.ok || !patient) {
        setStatusMessage(data.error || 'No matching patient found.')
        return
      }
      applyPatient(patient)
      setMode('new')
      setStatusMessage(`Loaded ${patient.hospital_id}`)
    } catch (error) {
      console.error(error)
      setStatusMessage('Could not load patient.')
    } finally {
      setLoading(false)
    }
  }

  async function submitAssessment(generatePrediction) {
    setLoading(true)
    setActionLoading(generatePrediction ? 'prediction' : 'draft')
    setStatusMessage('')
    try {
      const resp = await fetch(`${API_URL}/patient-assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospital_id: form.hospitalId,
          age: form.age,
          sex: form.sex,
          height: form.height,
          weight: form.weight,
          smoking_history: form.smokingHistory,
          baseline_spo2: form.baselineSpo2,
          bmi,
          surgery_type: form.surgeryType,
          urgency: form.urgency,
          surgery_duration: form.duration,
          blood_loss: form.bloodLoss,
          ward: form.patientDisposition,
          procedure_date: form.procedureDate,
          generate_prediction: generatePrediction,
        }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setStatusMessage(data.error || 'Could not save assessment.')
        return
      }
      setStatusMessage(
        generatePrediction
          ? `Prediction generated. Risk: ${data.prediction?.risk_level || 'pending'}`
          : 'Draft saved without generating prediction.'
      )
    } catch (error) {
      console.error(error)
      setStatusMessage(generatePrediction ? 'Could not generate prediction.' : 'Could not save draft.')
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  async function uploadAndTrainDataset() {
    if (!datasetFile) {
      setStatusMessage('Choose a CSV dataset first.')
      return
    }

    setLoading(true)
    setStatusMessage('')
    try {
      const fd = new FormData()
      fd.append('file', datasetFile)
      const uploadResp = await fetch(`${API_URL}/upload-dataset`, { method: 'POST', body: fd })
      const uploadData = await uploadResp.json()
      if (!uploadResp.ok) {
        setStatusMessage(uploadData.error || 'Could not upload dataset.')
        return
      }

      const trainResp = await fetch(`${API_URL}/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_path: uploadData.dataset_path,
          target: targetColumn,
          model_type: modelType,
        }),
      })
      const trainData = await trainResp.json()
      if (!trainResp.ok) {
        setStatusMessage(trainData.error || 'Could not start training.')
        return
      }
      setStatusMessage(`Dataset uploaded. Training job: ${trainData.job_id}`)
    } catch (error) {
      console.error(error)
      setStatusMessage('Could not upload and train dataset.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-[16px] border border-[#e2eaf5] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.07)] md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[14px] font-extrabold uppercase tracking-[0.14em] text-[#1768f2]">New Prediction</p>
            <h1 className="mt-2 text-[30px] font-black leading-tight text-[#071b49] md:text-[38px]">
              Patient assessment form
            </h1>
            <p className="mt-2 max-w-[620px] text-[16px] leading-7 text-[#53668a]">
              Create a patient record and capture surgical factors before generating oxygen risk.
            </p>
          </div>

          <div className="grid gap-2 rounded-[14px] bg-[#eef4fb] p-1 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`rounded-[12px] px-5 py-3 text-[15px] font-extrabold transition ${
                mode === 'new' ? 'bg-white text-[#071b49] shadow-sm' : 'text-[#53668a] hover:text-[#071b49]'
              }`}
            >
              Create new patient
            </button>
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`rounded-[12px] px-5 py-3 text-[15px] font-extrabold transition ${
                mode === 'existing' ? 'bg-white text-[#071b49] shadow-sm' : 'text-[#53668a] hover:text-[#071b49]'
              }`}
            >
              Existing patient
            </button>
            <button
              type="button"
              onClick={() => setMode('dataset')}
              className={`rounded-[12px] px-5 py-3 text-[15px] font-extrabold transition ${
                mode === 'dataset' ? 'bg-white text-[#071b49] shadow-sm' : 'text-[#53668a] hover:text-[#071b49]'
              }`}
            >
              Add dataset
            </button>
          </div>
        </div>
      </section>

      {mode === 'existing' && (
        <section className="rounded-[16px] border border-[#c7d8eb] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.07)] md:px-6">
          <h2 className="text-[22px] font-black text-[#071b49]">Find existing patient</h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              className="min-h-[48px] flex-1 rounded-[16px] border border-[#c7d8eb] bg-white px-4 text-[16px] font-semibold text-[#071b49] outline-none focus:border-[#1768f2]"
              placeholder="Search by Hospital ID"
              value={existingSearch}
              onChange={(event) => setExistingSearch(event.target.value)}
            />
            <button
              onClick={loadExistingPatient}
              disabled={loading}
              className="rounded-full bg-[#111b3b] px-6 py-3 text-[15px] font-extrabold text-white disabled:opacity-70"
            >
              {loading ? 'Loading...' : 'Load patient'}
            </button>
          </div>
        </section>
      )}

      {mode === 'dataset' ? (
        <DatasetPanel
          datasetName={datasetName}
          modelType={modelType}
          setDatasetName={setDatasetName}
          setDatasetFile={setDatasetFile}
          setModelType={setModelType}
          setTargetColumn={setTargetColumn}
          targetColumn={targetColumn}
          loading={loading}
          onUploadAndTrain={uploadAndTrainDataset}
        />
      ) : (
        <>
          <section className="grid min-w-0 gap-5 xl:grid-cols-2">
            <FormPanel title="Patient factors">
              <FormField label="Hospital ID" value={form.hospitalId} onChange={(value) => updateField('hospitalId', value)} />
              <FormField label="Age" value={form.age} onChange={(value) => updateField('age', value)} suffix="years" type="number" />
              <SelectField label="Sex" value={form.sex} onChange={(value) => updateField('sex', value)} options={['Female', 'Male']} />
              <FormField label="Height" value={form.height} onChange={(value) => updateField('height', value)} suffix="cm" type="number" />
              <FormField label="Weight" value={form.weight} onChange={(value) => updateField('weight', value)} suffix="kg" type="number" />
              <ReadOnlyField label="BMI" value={bmi ? `${bmi} kg/m2` : 'Enter height and weight'} />
              <SelectField label="Smoking history" value={form.smokingHistory} onChange={(value) => updateField('smokingHistory', value)} options={['No', 'Yes']} />
              <FormField label="Baseline SpO2" value={form.baselineSpo2} onChange={(value) => updateField('baselineSpo2', value)} suffix="%" type="number" />
            </FormPanel>

            <FormPanel title="Surgical factors">
              <FormField label="Surgery type" value={form.surgeryType} onChange={(value) => updateField('surgeryType', value)} />
              <SelectField label="Urgency" value={form.urgency} onChange={(value) => updateField('urgency', value)} options={['Elective', 'Emergency']} />
              <FormField label="Duration" value={form.duration} onChange={(value) => updateField('duration', value)} suffix="min" type="number" />
              <SelectField label="Blood loss" value={form.bloodLoss} onChange={(value) => updateField('bloodLoss', value)} options={['Low', 'Moderate', 'High']} />
          <SelectField
            label="Patient disposition"
            value={form.patientDisposition}
            onChange={(value) => updateField('patientDisposition', value)}
            options={['OPD', 'Ward', 'HDU', 'ICU']}
          />
              <FormField label="Procedure date" value={form.procedureDate} onChange={(value) => updateField('procedureDate', value)} type="date" />
            </FormPanel>
          </section>

          <section className="rounded-[16px] border border-[#e2eaf5] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(13,28,61,0.07)] sm:px-5">
            <div className="grid gap-3 sm:ml-auto sm:max-w-[560px] sm:grid-cols-2">
            <button
              onClick={() => submitAssessment(false)}
              disabled={loading}
              className="min-h-[52px] rounded-full bg-[#16a34a] px-6 py-3 text-[15px] font-extrabold text-white shadow-[0_10px_22px_rgba(22,163,74,0.18)] transition hover:bg-[#15803d] disabled:opacity-70"
            >
              {actionLoading === 'draft' ? 'Saving draft...' : 'Save draft'}
            </button>
            <button
              onClick={() => submitAssessment(true)}
              disabled={loading}
              className="min-h-[52px] rounded-full bg-[#facc15] px-7 py-3 text-[15px] font-extrabold text-[#071b49] shadow-[0_10px_22px_rgba(250,204,21,0.2)] transition hover:bg-[#eab308] disabled:opacity-70"
            >
              {actionLoading === 'prediction' ? 'Generating...' : 'Generate prediction'}
            </button>
            </div>
          </section>
        </>
      )}
      {statusMessage && (
        <div className="rounded-[14px] border border-[#c7d8eb] bg-white px-4 py-3 text-[14px] font-bold text-[#20365f] shadow-sm">
          {statusMessage}
        </div>
      )}
    </div>
  )
}

function FormPanel({ title, children }) {
  return (
    <section className="min-w-0 rounded-[20px] border border-[#cfdded] bg-[#f8fbff] px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.05)] md:px-6">
      <h2 className="text-[26px] font-black text-[#071b49]">{title}</h2>
      <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function FormField({ label, value, onChange, suffix, type = 'text' }) {
  return (
    <label className="min-w-0">
      <span className="mb-2 block text-[14px] font-bold text-[#6c7f9f]">{label}</span>
      <div className="flex min-h-[50px] items-center rounded-[16px] border border-[#c7d8eb] bg-white px-4 focus-within:border-[#1768f2]">
        <input
          className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold text-[#071b49] outline-none"
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && <span className="ml-2 shrink-0 text-[14px] font-bold text-[#6c7f9f]">{suffix}</span>}
      </div>
    </label>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="min-w-0">
      <span className="mb-2 block text-[14px] font-bold text-[#6c7f9f]">{label}</span>
      <select
        className="min-h-[50px] w-full rounded-[16px] border border-[#c7d8eb] bg-white px-4 text-[16px] font-semibold text-[#071b49] outline-none focus:border-[#1768f2]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="min-w-0">
      <span className="mb-2 block text-[14px] font-bold text-[#6c7f9f]">{label}</span>
      <div className="flex min-h-[50px] items-center rounded-[16px] border border-[#c7d8eb] bg-[#eef4fb] px-4 text-[16px] font-black text-[#071b49]">
        {value}
      </div>
    </div>
  )
}

function DatasetPanel({
  datasetName,
  loading,
  modelType,
  onUploadAndTrain,
  setDatasetName,
  setDatasetFile,
  setModelType,
  setTargetColumn,
  targetColumn,
}) {
  return (
    <section className="rounded-[20px] border border-[#cfdded] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.07)] md:px-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-[28px] font-black text-[#071b49]">Add training dataset</h2>
          <p className="mt-2 max-w-[650px] text-[16px] leading-7 text-[#53668a]">
            Upload a CSV dataset to prepare model training and validation for postoperative oxygen risk prediction.
          </p>
        </div>
        <span className="rounded-full bg-[#eaf2ff] px-4 py-2 text-[13px] font-extrabold text-[#1768f2]">
          CSV only
        </span>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <label className="flex min-h-[210px] cursor-pointer flex-col items-center justify-center rounded-[20px] border-2 border-dashed border-[#b8cbe4] bg-[#f8fbff] px-6 text-center transition hover:border-[#1768f2] hover:bg-[#f3f8ff]">
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] || null
              setDatasetFile(file)
              setDatasetName(file?.name || '')
            }}
          />
          <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#eaf2ff] text-[#1768f2]">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="M17 8l-5-5-5 5" />
              <path d="M12 3v12" />
            </svg>
          </div>
          <p className="mt-4 text-[18px] font-black text-[#071b49]">
            {datasetName || 'Choose dataset file'}
          </p>
          <p className="mt-2 text-[14px] leading-6 text-[#6c7f9f]">
            Select a `.csv` file containing patient, surgery, anesthesia, and outcome columns.
          </p>
        </label>

        <div className="space-y-4 rounded-[18px] border border-[#cfdded] bg-[#f8fbff] p-5">
          <FormField label="Dataset name" value={datasetName} onChange={setDatasetName} />
          {/* <FormField label="Target column" value={targetColumn} onChange={setTargetColumn} /> */}
          <SelectField
            label="Model type"
            value={modelType}
            onChange={setModelType}
            options={['xgboost', 'random_forest', 'logistic_regression', 'lightgbm', 'knn', 'svm']}
          />
          <button
            onClick={onUploadAndTrain}
            disabled={loading}
            className="w-full rounded-full bg-[#111b3b] px-7 py-3 text-[15px] font-extrabold text-white disabled:opacity-70"
          >
            {loading ? 'Uploading...' : 'Upload dataset'}
          </button>
          <button
            onClick={onUploadAndTrain}
            disabled={loading}
            className="w-full rounded-full border border-[#c7d8eb] bg-white px-7 py-3 text-[15px] font-extrabold text-[#20365f] disabled:opacity-70"
          >
            Start training
          </button>
        </div>
      </div>
    </section>
  )
}

function capitalize(value) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}
