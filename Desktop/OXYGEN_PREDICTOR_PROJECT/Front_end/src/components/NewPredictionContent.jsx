import React, { useMemo, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const yesNo = ['No', 'Yes']
const yesNoUnknown = ['No', 'Yes', 'Not documented']

const initialForm = {
  wardService: 'Surgery',
  patientCodedId: 'KBH-2026-00128',
  admissionDate: '2026-04-20',
  surgeryDate: '2026-04-21',
  dischargeOrDeathDate: '',
  screeningAge: '62',
  screeningSex: 'Female',
  eligibleForStudy: 'Yes',
  exclusionReason: '',
  dataSourcesReviewed: 'OpenMRS, patient file, theatre register, anesthesia chart',
  age: '62',
  sex: 'Female',
  weight: '85',
  height: '165',
  smokingHistory: 'No',
  alcoholUse: 'No',
  asaClass: 'II',
  preExistingRespiratoryDisease: 'No',
  copdAsthma: 'No',
  cardiovascularDisease: 'No',
  hypertension: 'No',
  diabetesMellitus: 'No',
  renalDisease: 'No',
  hivStatus: 'Unknown',
  anemia: 'No',
  bmiCategory: '',
  obesity: 'No',
  sleepApnea: 'Not documented',
  baselineSpo2: '95',
  baselineRespiratoryRate: '',
  baselineHeartRate: '',
  baselineSystolicBp: '',
  baselineDiastolicBp: '',
  preoperativeHemoglobin: '',
  otherPreoperativeLabs: '',
  surgicalSpecialty: 'General surgery',
  typeOfSurgery: '',
  procedurePerformed: '',
  surgeryStatus: 'Emergency',
  surgeryMagnitude: 'Major',
  surgicalApproach: 'Open',
  incisionType: '',
  durationOfSurgery: '210',
  estimatedBloodLoss: '',
  bloodTransfusionGiven: 'No',
  patientPosition: 'Supine',
  typeOfAnesthesia: 'General',
  airwayType: 'Endotracheal tube',
  intraoperativeOpioidUse: 'No',
  totalOpioidDose: '',
  sedativeUse: 'No',
  muscleRelaxantUsed: 'No',
  reversalAgentUsed: 'No',
  intraoperativeHypotension: 'No',
  intraoperativeBronchospasm: 'No',
  intraoperativeDesaturation: 'No',
  intraoperativeSpo2: '',
  intraoperativeFluidVolume: '',
  vasopressorUsed: 'No',
}

const sections = [
  {
    title: 'B1. Patient-related and preoperative variables',
    columns: 3,
    fields: [
      field('age', 'Age', 'number', null, 'Patient file / OpenMRS', 'years', 'Continuous'),
      field('sex', 'Sex', 'select', ['Female', 'Male'], 'Patient file / OpenMRS', null, 'Male=1, Female=2'),
      field('weight', 'Weight', 'number', null, 'Patient file / chart', 'kg', 'Continuous'),
      field('height', 'Height', 'number', null, 'Patient file / chart', 'cm'),
      { key: 'bmi', label: 'Body mass index', type: 'readonly', source: 'Derived from weight and height', suffix: 'kg/m2' },
      field('smokingHistory', 'Smoking history', 'select', yesNoUnknown, 'History in patient file'),
      field('alcoholUse', 'Alcohol use', 'select', yesNoUnknown, 'History in patient file'),
      field('asaClass', 'ASA class', 'select', ['I', 'II', 'III', 'IV', 'V'], 'Anesthesia chart'),
      field('preExistingRespiratoryDisease', 'Pre-existing respiratory disease', 'select', yesNo, 'History in file', null, 'Yes=1, No=2'),
      field('copdAsthma', 'COPD / asthma', 'select', yesNo, 'History in file', null, 'Yes=1, No=2'),
      field('cardiovascularDisease', 'Cardiovascular disease', 'select', yesNo, 'History in file', null, 'Yes=1, No=2'),
      field('hypertension', 'Hypertension', 'select', yesNo, 'History in file', null, 'Yes=1, No=2'),
      field('diabetesMellitus', 'Diabetes mellitus', 'select', yesNo, 'History in file', null, 'Yes=1, No=2'),
      field('renalDisease', 'Renal disease', 'select', yesNo, 'History in file', null, 'Yes=1, No=2'),
      field('hivStatus', 'HIV status', 'select', ['Positive', 'Negative', 'Unknown'], 'OpenMRS / file', null, 'Positive=1, Negative=2, Unknown=3'),
      field('anemia', 'Anemia', 'select', yesNo, 'Lab chart / file', null, 'Yes=1, No=2'),
      field('bmiCategory', 'BMI category', 'text', null, 'Derived from BMI'),
      field('obesity', 'Obesity', 'select', yesNo, 'Derived / file'),
      field('sleepApnea', 'Sleep apnea', 'select', yesNoUnknown, 'History in file'),
      field('baselineSpo2', 'Baseline room-air SpO2', 'number', null, 'Preoperative chart / nursing chart', '%'),
      field('baselineRespiratoryRate', 'Baseline respiratory rate', 'number', null, 'Preoperative chart', 'breaths/min'),
      field('baselineHeartRate', 'Baseline heart rate', 'number', null, 'Preoperative chart', 'beats/min'),
      field('baselineSystolicBp', 'Baseline systolic BP', 'number', null, 'Preoperative chart', 'mmHg'),
      field('baselineDiastolicBp', 'Baseline diastolic BP', 'number', null, 'Preoperative chart', 'mmHg'),
      field('preoperativeHemoglobin', 'Preoperative hemoglobin', 'number', null, 'Lab chart', 'g/dL'),
      field('otherPreoperativeLabs', 'Other relevant preoperative laboratory values', 'textarea', null, 'Lab chart'),
    ],
  },
  {
    title: 'B2. Surgery-related variables',
    columns: 3,
    fields: [
      field('surgicalSpecialty', 'Surgical specialty', 'select', ['General surgery', 'Orthopedics', 'Obstetrics-gynecology', 'ENT', 'Other'], 'Theatre register / file', null, 'General surgery=1, Orthopedics=2, Obstetrics-gynecology=3, ENT=4, Other=5'),
      field('typeOfSurgery', 'Type of surgery', 'text', null, 'Theatre register / file', null, 'Numeric code'),
      field('procedurePerformed', 'Procedure performed', 'textarea', null, 'Operation notes', null, 'Numeric code or free text'),
      field('surgeryStatus', 'Surgery status', 'select', ['Elective', 'Emergency'], 'Theatre register / file', null, 'Elective=1, Emergency=2'),
      field('surgeryMagnitude', 'Major or minor surgery', 'select', ['Major', 'Minor'], 'Operation notes', null, 'Major=1, Minor=2'),
      field('surgicalApproach', 'Surgical approach', 'select', ['Open', 'Minimally invasive', 'Other'], 'Operation notes', null, 'Open=1, Minimally invasive=2, Other=3'),
      field('incisionType', 'Incision type, if relevant', 'text', null, 'Operation notes', null, 'Numerical coding'),
      field('durationOfSurgery', 'Duration of surgery', 'number', null, 'Theatre register / anesthesia chart', 'min', 'Continuous'),
      field('estimatedBloodLoss', 'Estimated blood loss', 'number', null, 'Operation note / anesthesia chart', 'mL', 'Continuous'),
      field('bloodTransfusionGiven', 'Blood transfusion given', 'select', yesNo, 'Anesthesia chart / file', null, 'Yes=1, No=0'),
      field('patientPosition', 'Patient position during surgery', 'select', ['Supine', 'Prone', 'Lateral', 'Lithotomy', 'Other'], 'Anesthesia chart', null, 'Supine=1, Prone=2, Lateral=3, Lithotomy=4, Other=5'),
    ],
  },
  {
    title: 'B3. Anesthesia-related variables',
    columns: 3,
    fields: [
      field('typeOfAnesthesia', 'Type of anesthesia', 'select', ['General', 'Spinal', 'Regional', 'Combined', 'Other'], 'Anesthesia chart', null, 'General=1, Spinal=2, Regional=3, Combined=4, Other=5'),
      field('airwayType', 'Airway type', 'select', ['Endotracheal tube', 'Laryngeal mask airway', 'Face mask', 'Other'], 'Anesthesia chart', null, 'Endotracheal tube=1, Laryngeal mask airway=2, Face mask=3, Other=4'),
      field('intraoperativeOpioidUse', 'Intraoperative opioid use', 'select', yesNo, 'Anesthesia chart', null, 'Yes=1, No=0'),
      field('totalOpioidDose', 'Total opioid dose', 'text', null, 'Anesthesia chart', null, 'Specify drug and dose'),
      field('sedativeUse', 'Sedative use', 'select', yesNo, 'Anesthesia chart', null, 'Yes=1, No=0'),
      field('muscleRelaxantUsed', 'Muscle relaxant used', 'select', yesNo, 'Anesthesia chart', null, 'Yes=1, No=0'),
      field('reversalAgentUsed', 'Reversal agent used', 'select', yesNo, 'Anesthesia chart', null, 'Yes=1, No=0'),
      field('intraoperativeHypotension', 'Intraoperative hypotension', 'select', yesNo, 'Anesthesia chart', null, 'Yes=1, No=0'),
      field('intraoperativeBronchospasm', 'Intraoperative wheezing / bronchospasm', 'select', yesNo, 'Anesthesia chart', null, 'Yes=1, No=0'),
      field('intraoperativeDesaturation', 'Intraoperative desaturation episode', 'select', yesNo, 'Anesthesia chart', null, 'Yes=1, No=0'),
      field('intraoperativeSpo2', 'Intraoperative SpO2', 'number', null, 'Anesthesia chart', '%', 'Continuous'),
      field('intraoperativeFluidVolume', 'Intraoperative fluid volume', 'number', null, 'Anesthesia chart', 'mL', 'Continuous'),
      field('vasopressorUsed', 'Vasopressor used', 'select', yesNo, 'Anesthesia chart', null, 'Yes=1, No=0'),
    ],
  },
]

export default function NewPredictionContent() {
  const [mode, setMode] = useState('new')
  const [form, setForm] = useState(initialForm)
  const [datasetName, setDatasetName] = useState('')
  const [targetColumn, setTargetColumn] = useState('')
  const [modelType, setModelType] = useState('xgboost')
  const [datasetFile, setDatasetFile] = useState(null)
  const [datasetColumns, setDatasetColumns] = useState([])
  const [existingSearch, setExistingSearch] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [predictionResult, setPredictionResult] = useState(null)
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
      patientCodedId: patient.hospital_id || current.patientCodedId,
      age: patient.age ? String(patient.age) : current.age,
      screeningAge: patient.age ? String(patient.age) : current.screeningAge,
      sex: patient.sex || current.sex,
      screeningSex: patient.sex || current.screeningSex,
      smokingHistory: patient.smoking_history ? 'Yes' : 'No',
      baselineSpo2: patient.baseline_spo2 ? String(patient.baseline_spo2) : current.baselineSpo2,
      typeOfSurgery: record.surgery_type || current.typeOfSurgery,
      surgeryStatus: record.urgency ? capitalize(record.urgency) : current.surgeryStatus,
      durationOfSurgery: record.surgery_duration ? String(record.surgery_duration) : current.durationOfSurgery,
      estimatedBloodLoss: record.blood_loss || current.estimatedBloodLoss,
      wardService: record.ward || current.wardService,
      surgeryDate: record.procedure_date || current.surgeryDate,
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
    if (!generatePrediction) setPredictionResult(null)

    const draft = { ...form, bmi }
    try {
      localStorage.setItem('postopOxygenPredictionDraft', JSON.stringify(draft))

      if (!generatePrediction) {
        setStatusMessage('Draft saved in this browser.')
        return
      }

      const resp = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: buildPredictionPayload(form, bmi), model_type: modelType }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setStatusMessage(data.error || 'Could not generate prediction.')
        return
      }
      setPredictionResult(data)
      setStatusMessage(`Prediction generated. Risk: ${data.risk_level || 'pending'}`)
    } catch (error) {
      console.error(error)
      setStatusMessage(generatePrediction ? 'Could not generate prediction.' : 'Could not save draft.')
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  async function handleDatasetFile(file) {
    setDatasetFile(file)
    setDatasetName(file?.name || '')
    setTargetColumn('')
    setDatasetColumns([])

    if (!file) return

    const columns = await extractDatasetColumns(file)
    setDatasetColumns(columns)
    if (columns.length > 0) setTargetColumn(columns[0])
    if (columns.length === 0) setStatusMessage('Could not detect dataset columns. Use CSV, TSV, TXT, or JSON with column names.')
  }

  async function uploadAndPredictDataset() {
    if (!datasetFile) {
      setStatusMessage('Choose a dataset file first.')
      return
    }

    if (!targetColumn) {
      setStatusMessage('Select the target column from the dataset.')
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

      setStatusMessage(`Dataset uploaded for prediction. Target column: ${targetColumn}. Model type: ${modelType}.`)
    } catch (error) {
      console.error(error)
      setStatusMessage('Could not upload and predict from dataset.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="prediction-form-16 min-w-0 space-y-5">
      <section className="rounded-[16px] border border-[#d7e2ef] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.07)] md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#1768f2]">New Prediction</p>
            <h1 className="mt-2 text-[30px] font-black leading-tight text-[#071b49] md:text-[38px]">
              Postoperative oxygen prediction form
            </h1>
            <p className="mt-2 max-w-[720px] text-[16px] leading-7 text-[#53668a]">
              Capture screening details and candidate predictors before generating an oxygen requirement risk estimate.
            </p>
          </div>

          <div className="grid gap-2 rounded-[14px] bg-[#eef4fb] p-1 sm:grid-cols-3">
            <ModeButton active={mode === 'new'} onClick={() => setMode('new')}>Prediction form</ModeButton>
            <ModeButton active={mode === 'existing'} onClick={() => setMode('existing')}>Existing patient</ModeButton>
            <ModeButton active={mode === 'dataset'} onClick={() => setMode('dataset')}>Add dataset</ModeButton>
          </div>
        </div>
      </section>

      {mode === 'existing' && (
        <section className="rounded-[16px] border border-[#c7d8eb] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.07)] md:px-6">
          <h2 className="text-[22px] font-black text-[#071b49]">Search by patient Hospital ID</h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              className="min-h-[48px] flex-1 rounded-[10px] border border-[#c7d8eb] bg-white px-4 text-[16px] font-semibold text-[#071b49] outline-none focus:border-[#1768f2]"
              placeholder="Enter Patient Hospital ID to fetch data from Hospital EMR"
              value={existingSearch}
              onChange={(event) => setExistingSearch(event.target.value)}
            />
            <button
              onClick={loadExistingPatient}
              disabled={loading}
              className="rounded-[10px] bg-[#111b3b] px-6 py-3 text-[15px] font-extrabold text-white disabled:opacity-70"
            >
              {loading ? 'Loading...' : 'Load patient'}
            </button>
          </div>
        </section>
      )}

      {mode === 'dataset' ? (
        <DatasetPanel
          datasetName={datasetName}
          datasetColumns={datasetColumns}
          modelType={modelType}
          onDatasetFileChange={handleDatasetFile}
          setModelType={setModelType}
          setTargetColumn={setTargetColumn}
          targetColumn={targetColumn}
          loading={loading}
          onUploadAndPredict={uploadAndPredictDataset}
        />
      ) : (
        <>
          {sections.map((section) => (
            <FormSection
              key={section.title}
              bmi={bmi}
              form={form}
              section={section}
              updateField={updateField}
            />
          ))}

          <section className="rounded-[16px] border border-[#e2eaf5] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(13,28,61,0.07)] sm:px-5">
            <div className="grid gap-3 sm:ml-auto sm:max-w-[560px] sm:grid-cols-2">
              <button
                onClick={() => submitAssessment(false)}
                disabled={loading}
                className="min-h-[52px] rounded-[10px] bg-[#16894f] px-6 py-3 text-[15px] font-extrabold text-white shadow-[0_10px_22px_rgba(22,137,79,0.18)] transition hover:bg-[#126f41] disabled:opacity-70"
              >
                {actionLoading === 'draft' ? 'Saving draft...' : 'Save draft'}
              </button>
              <button
                onClick={() => submitAssessment(true)}
                disabled={loading}
                className="min-h-[52px] rounded-[10px] bg-[#f2c94c] px-7 py-3 text-[15px] font-extrabold text-[#071b49] shadow-[0_10px_22px_rgba(242,201,76,0.22)] transition hover:bg-[#e6b928] disabled:opacity-70"
              >
                {actionLoading === 'prediction' ? 'Generating...' : 'Generate prediction'}
              </button>
            </div>
          </section>

          {predictionResult && <GeneratedOutcomeSection prediction={predictionResult} />}
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

function FormSection({ bmi, form, section, updateField }) {
  const gridClass = section.columns === 3 ? 'lg:grid-cols-2 2xl:grid-cols-3' : 'lg:grid-cols-2'

  return (
    <section className="min-w-0 rounded-[16px] border border-[#cfdded] bg-[#f8fbff] px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.05)] md:px-6">
      <div className={`grid min-w-0 gap-4 ${gridClass}`}>
        {section.fields.map((item) => (
          <DataField
            key={item.key}
            field={item}
            value={item.key === 'bmi' ? bmi : form[item.key]}
            onChange={(value) => updateField(item.key, value)}
          />
        ))}
      </div>
    </section>
  )
}

function DataField({ field: item, onChange, value }) {
  if (item.type === 'readonly') {
    return <ReadOnlyField label={item.label} source={item.source} suffix={item.suffix} value={value || 'Enter height and weight'} />
  }

  if (item.type === 'select') {
    return (
      <FieldShell coding={item.coding} label={item.label} source={item.source}>
        <select
          className="min-h-[50px] w-full rounded-[10px] border border-[#c7d8eb] bg-white px-4 text-[15px] font-semibold text-[#071b49] outline-none focus:border-[#1768f2]"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {item.options.map((option) => (
            <option key={option || 'blank'} value={option}>{option || 'Not recorded'}</option>
          ))}
        </select>
      </FieldShell>
    )
  }

  if (item.type === 'textarea') {
    return (
      <FieldShell coding={item.coding} label={item.label} source={item.source}>
        <textarea
          className="min-h-[94px] w-full resize-y rounded-[10px] border border-[#c7d8eb] bg-white px-4 py-3 text-[15px] font-semibold text-[#071b49] outline-none focus:border-[#1768f2]"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </FieldShell>
    )
  }

  return (
    <FieldShell coding={item.coding} label={item.label} source={item.source}>
      <div className="flex min-h-[50px] items-center rounded-[10px] border border-[#c7d8eb] bg-white px-4 focus-within:border-[#1768f2]">
        <input
          className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#071b49] outline-none"
          type={item.type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {item.suffix && <span className="ml-2 shrink-0 text-[13px] font-bold text-[#6c7f9f]">{item.suffix}</span>}
      </div>
    </FieldShell>
  )
}

function FieldShell({ children, coding, label, source }) {
  return (
    <label className="min-w-0">
      <span className="mb-2 block text-[14px] font-bold text-[#49617f]">{label}</span>
      {children}
    </label>
  )
}

function ReadOnlyField({ label, source, suffix, value }) {
  return (
    <div className="min-w-0">
      <span className="mb-2 block text-[14px] font-bold text-[#49617f]">{label}</span>
      <div className="flex min-h-[50px] items-center rounded-[10px] border border-[#c7d8eb] bg-[#eef4fb] px-4 text-[15px] font-black text-[#071b49]">
        {value}{value && suffix ? ` ${suffix}` : ''}
      </div>
    </div>
  )
}

function ModeButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[10px] px-5 py-3 text-[15px] font-extrabold transition ${
        active ? 'bg-white text-[#071b49] shadow-sm' : 'text-[#53668a] hover:text-[#071b49]'
      }`}
    >
      {children}
    </button>
  )
}

function GeneratedOutcomeSection({ prediction }) {
  const probability = Math.round(Number(prediction.predicted_probability || prediction.probability || 0) * 100)
  const riskLevel = prediction.risk_level || 'Pending'
  const oxygenRequired = prediction.predicted_class || (probability >= 50 ? 'Yes' : 'No')
  const recommendation = dispositionRecommendation(riskLevel)

  return (
    <section className="rounded-[16px] border border-[#cfdded] bg-[#f8fbff] px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.05)] md:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-[24px] font-black text-[#071b49]">Generated prediction summary</h2>
          <p className="mt-2 max-w-[760px] text-[15px] leading-6 text-[#53668a]">
            Risk: <span className="font-black text-[#071b49]">{riskLevel}</span>. Recommended destination:{' '}
            <span className="font-black text-[#071b49]">{recommendation.unit}</span>.
          </p>
          <div className="mt-4 rounded-[12px] border border-[#d7e4f4] bg-white px-4 py-4">
            <p className="text-[13px] font-black uppercase tracking-[0.12em] text-[#1768f2]">Recommendation</p>
            <p className="mt-2 text-[15px] font-semibold leading-6 text-[#20365f]">{recommendation.text}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
          <OutcomeMetric label="Probability" value={`${Number.isFinite(probability) ? probability : 0}%`} />
          <OutcomeMetric label="Oxygen required" value={oxygenRequired} />
        </div>
      </div>
    </section>
  )
}

function OutcomeMetric({ label, value }) {
  return (
    <div className="rounded-[12px] border border-[#d7e4f4] bg-white px-4 py-3">
      <p className="text-[13px] font-bold text-[#6c7f9f]">{label}</p>
      <p className="mt-1 text-[22px] font-black text-[#071b49]">{value}</p>
    </div>
  )
}

function DatasetPanel({
  datasetColumns,
  datasetName,
  loading,
  modelType,
  onDatasetFileChange,
  onUploadAndPredict,
  setModelType,
  setTargetColumn,
  targetColumn,
}) {
  return (
    <section className="rounded-[16px] border border-[#cfdded] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.07)] md:px-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-[28px] font-black text-[#071b49]">Upload dataset for prediction</h2>
          <p className="mt-2 max-w-[650px] text-[16px] leading-7 text-[#53668a]">
            Upload a patient dataset, choose the target column from its columns, and run prediction with the selected model.
          </p>
        </div>
        <span className="rounded-[10px] bg-[#eaf2ff] px-4 py-2 text-[13px] font-extrabold text-[#1768f2]">
          CSV, TSV, JSON
        </span>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <label className="flex min-h-[210px] cursor-pointer flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-[#b8cbe4] bg-[#f8fbff] px-6 text-center transition hover:border-[#1768f2] hover:bg-[#f3f8ff]">
          <input
            type="file"
            accept=".csv,.tsv,.txt,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] || null
              onDatasetFileChange(file)
            }}
          />
          <div className="flex h-14 w-14 items-center justify-center rounded-[12px] bg-[#eaf2ff] text-[#1768f2]">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="M17 8l-5-5-5 5" />
              <path d="M12 3v12" />
            </svg>
          </div>
          <p className="mt-4 text-[18px] font-black text-[#071b49]">
            {datasetName || 'Choose dataset file'}
          </p>
        </label>

        <div className="space-y-4 rounded-[14px] border border-[#cfdded] bg-[#f8fbff] p-5">
          <ReadOnlyDatasetField label="Dataset name" value={datasetName || 'No dataset selected'} />
          <SimpleSelect
            label="Target column"
            value={targetColumn}
            onChange={setTargetColumn}
            options={datasetColumns}
            placeholder={datasetColumns.length > 0 ? 'Select target column' : 'Upload readable dataset first'}
          />
          <SimpleSelect
            label="Model type"
            value={modelType}
            onChange={setModelType}
            options={['xgboost', 'random_forest', 'logistic_regression', 'lightgbm', 'knn', 'svm']}
          />
          <button
            onClick={onUploadAndPredict}
            disabled={loading || !datasetName || !targetColumn}
            className="w-full rounded-[10px] bg-[#111b3b] px-7 py-3 text-[15px] font-extrabold text-white disabled:opacity-70"
          >
            {loading ? 'Uploading...' : 'Upload and predict'}
          </button>
        </div>
      </div>
    </section>
  )
}

function ReadOnlyDatasetField({ label, value }) {
  return (
    <div className="block">
      <span className="mb-2 block text-[14px] font-bold text-[#49617f]">{label}</span>
      <div className="flex min-h-[50px] items-center rounded-[10px] border border-[#c7d8eb] bg-white px-4 text-[15px] font-semibold text-[#071b49]">
        {value}
      </div>
    </div>
  )
}

function SimpleSelect({ label, options, onChange, placeholder, value }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[14px] font-bold text-[#49617f]">{label}</span>
      <select
        className="min-h-[50px] w-full rounded-[10px] border border-[#c7d8eb] bg-white px-4 text-[15px] font-semibold text-[#071b49] outline-none focus:border-[#1768f2]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

async function extractDatasetColumns(file) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  const text = await file.text()

  if (extension === 'json') return extractJsonColumns(text)
  if (extension === 'tsv') return parseDelimitedHeader(text, '\t')

  const firstLine = text.split(/\r?\n/).find((line) => line.trim())
  if (!firstLine) return []

  const delimiter = firstLine.includes('\t') ? '\t' : ','
  return parseDelimitedHeader(text, delimiter)
}

function extractJsonColumns(text) {
  try {
    const parsed = JSON.parse(text)
    const firstRecord = Array.isArray(parsed) ? parsed[0] : parsed
    if (!firstRecord || typeof firstRecord !== 'object' || Array.isArray(firstRecord)) return []
    return Object.keys(firstRecord)
  } catch (error) {
    console.error(error)
    return []
  }
}

function parseDelimitedHeader(text, delimiter) {
  const headerLine = text.split(/\r?\n/).find((line) => line.trim())
  if (!headerLine) return []
  return splitDelimitedLine(headerLine, delimiter)
    .map((column) => column.trim())
    .filter(Boolean)
}

function splitDelimitedLine(line, delimiter) {
  const values = []
  let current = ''
  let insideQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]

    if (char === '"' && nextChar === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      insideQuotes = !insideQuotes
    } else if (char === delimiter && !insideQuotes) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }

  values.push(current)
  return values
}

function buildPredictionPayload(form, bmi) {
  const comorbidities = [
    ['respiratory_disease', form.preExistingRespiratoryDisease],
    ['copd_asthma', form.copdAsthma],
    ['cardiovascular_disease', form.cardiovascularDisease],
    ['hypertension', form.hypertension],
    ['diabetes_mellitus', form.diabetesMellitus],
    ['renal_disease', form.renalDisease],
    ['hiv_status', form.hivStatus],
    ['anemia', form.anemia],
    ['obesity', form.obesity],
    ['sleep_apnea', form.sleepApnea],
  ]
    .filter(([, value]) => value && value !== 'No')
    .map(([key, value]) => `${key}:${value}`)
    .join('; ')

  return {
    patient_coded_id: form.patientCodedId,
    age: Number(form.age || form.screeningAge) || 0,
    sex: form.sex,
    bmi: Number(bmi) || 0,
    smoking_history: form.smokingHistory === 'Yes',
    comorbidities,
    baseline_spo2: Number(form.baselineSpo2) || 0,
    surgery_type: form.typeOfSurgery || form.surgicalSpecialty,
    urgency: String(form.surgeryStatus || '').toLowerCase(),
    surgery_duration: Number(form.durationOfSurgery) || 0,
    blood_loss: form.estimatedBloodLoss || 'Not documented',
    ward: form.wardService,
    anesthesia_type: form.typeOfAnesthesia,
    asa_class: form.asaClass,
    residual_effects: form.reversalAgentUsed === 'No' && form.muscleRelaxantUsed === 'Yes',
    opioid_use: form.intraoperativeOpioidUse === 'Yes',
    airway_event: form.intraoperativeBronchospasm === 'Yes' || form.intraoperativeDesaturation === 'Yes',
    respiratory_rate: Number(form.baselineRespiratoryRate) || 0,
    time_since_surgery: 0,
    full_case_report_form: form,
  }
}

function dispositionRecommendation(riskLevel) {
  const normalizedRisk = String(riskLevel || '').toLowerCase()
  if (normalizedRisk.includes('high')) {
    return {
      unit: 'ICU',
      text: 'Prepare oxygen support, monitor SpO2 closely, alert anesthesia/recovery team, and escalate if saturation remains low or respiratory distress occurs.',
    }
  }
  if (normalizedRisk.includes('moderate') || normalizedRisk.includes('medium')) {
    return {
      unit: 'HDU',
      text: 'Monitor SpO2 regularly, keep oxygen available, reassess before ward transfer, and escalate if the patient deteriorates.',
    }
  }
  return {
    unit: 'Ward',
    text: 'Continue routine postoperative monitoring. Oxygen is not required unless SpO2 decreases or symptoms develop.',
  }
}

function field(key, label, type, options, source, suffix, coding) {
  return { key, label, type, options, source, suffix, coding }
}

function capitalize(value) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}
