import React, { useMemo, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const initialForm = {
  wardService: 'Surgery',
  hospitalId: 'KBH-2026-00128',
  admissionDate: '',
  surgeryDate: '2026-04-21',
  dischargeOrDeathDate: '',
  age: '62',
  sex: 'Female',
  eligibleForStudy: 'Yes',
  exclusionReason: '',
  dataSourcesReviewed: 'Patient file',
  weight: '85',
  height: '165',
  smokingHistory: 'No',
  alcoholUse: 'Not documented',
  asaClass: 'III',
  preExistingRespiratoryDisease: 'No',
  copdAsthma: 'No',
  cardiovascularDisease: 'No',
  hypertension: 'No',
  diabetesMellitus: 'No',
  renalDisease: 'No',
  hivStatus: 'Unknown',
  anemia: 'No',
  obesity: 'Yes',
  sleepApnea: 'Not documented',
  baselineSpo2: '95',
  baselineRespiratoryRate: '',
  baselineHeartRate: '',
  baselineSystolicBp: '',
  baselineDiastolicBp: '',
  preoperativeHemoglobin: '',
  otherPreoperativeLabs: '',
  surgicalSpecialty: 'General surgery',
  surgeryType: 'Abdominal procedure',
  procedurePerformed: '',
  urgency: 'Emergency',
  majorMinorSurgery: 'Major',
  surgicalApproach: 'Open',
  incisionType: '',
  duration: '210',
  estimatedBloodLoss: '',
  bloodLoss: 'Moderate',
  bloodTransfusion: 'No',
  patientPosition: 'Supine',
  anesthesiaType: 'General',
  airwayType: 'Endotracheal tube',
  intraoperativeOpioidUse: 'Yes',
  totalOpioidDose: '',
  sedativeUse: 'No',
  muscleRelaxantUsed: 'Yes',
  reversalAgentUsed: 'Yes',
  intraoperativeHypotension: 'No',
  intraoperativeBronchospasm: 'No',
  intraoperativeDesaturation: 'No',
  intraoperativeSpo2: '',
  intraoperativeFluidVolume: '',
  vasopressorUsed: 'No',
  pacuAdmissionSpo2: '90',
  pacuDischargeSpo2: '',
  postoperativeRespiratoryRate: '22',
  postoperativeHeartRate: '',
  postoperativeSystolicBp: '',
  postoperativeDiastolicBp: '',
  temperature: '',
  consciousness: 'Alert',
  painScore: '',
  respiratoryDistressSigns: 'No',
  wheezeOrStridor: 'No',
  lowestPostopSpo2: '',
  deepBreathingCough: 'Not documented',
  timeSinceSurgery: '',
  oxygenBeforePrediction: 'No',
  primaryOutcome: 'No',
  timeToFirstOxygen: '',
  oxygenInitiationReason: '',
  postoperativeOxygenDevice: '',
  oxygenQuantity: '',
  oxygenDuration: '',
  escalationRespiratorySupport: 'No',
  icuHduTransfer: 'No',
  mechanicalVentilationRequired: 'No',
  postoperativeDeath: 'No',
}

const yesNo = ['No', 'Yes']
const yesNoNotDocumented = ['No', 'Yes', 'Not documented']

const formSections = [
  {
    title: 'Section A. Screening and record identification',
    description: 'De-identified patient details and source documents reviewed before eligibility confirmation.',
    fields: [
      { name: 'wardService', label: 'Ward or service', type: 'select', options: ['Surgery', 'PACU', 'ICU', 'HDU', 'Other'], source: 'Ward register / file' },
      { name: 'hospitalId', label: 'Patient coded ID', source: 'Patient file / OpenMRS' },
      { name: 'admissionDate', label: 'Date of admission', type: 'date', source: 'Admission register / file' },
      { name: 'surgeryDate', label: 'Date of surgery', type: 'date', source: 'Theatre register / anesthesia chart' },
      { name: 'dischargeOrDeathDate', label: 'Date of discharge or death', type: 'date', source: 'Discharge summary / file' },
      { name: 'eligibleForStudy', label: 'Eligible for study', type: 'select', options: yesNo, source: 'Screening review' },
      { name: 'exclusionReason', label: 'Reason for exclusion, if any', type: 'textarea', source: 'Screening review' },
      { name: 'dataSourcesReviewed', label: 'Data sources reviewed', type: 'select', options: ['OpenMRS', 'Patient file', 'Theatre register', 'Anesthesia chart', 'Recovery chart', 'Nursing chart'], source: 'Research review' },
    ],
  },
  {
    title: 'B1. Patient-related and preoperative variables',
    description: 'Baseline patient characteristics, comorbidities, vital signs, and preoperative laboratory values.',
    fields: [
      { name: 'age', label: 'Age', type: 'number', suffix: 'years', source: 'Patient file / OpenMRS' },
      { name: 'sex', label: 'Sex', type: 'select', options: ['Female', 'Male'], source: 'Patient file / OpenMRS' },
      { name: 'weight', label: 'Weight', type: 'number', suffix: 'kg', source: 'Patient file / chart' },
      { name: 'height', label: 'Height', type: 'number', suffix: 'cm', source: 'Patient file / chart' },
      { name: 'bmi', label: 'Body mass index', type: 'readonly', source: 'Derived from weight and height' },
      { name: 'smokingHistory', label: 'Smoking history', type: 'select', options: yesNoNotDocumented, source: 'History in patient file' },
      { name: 'alcoholUse', label: 'Alcohol use', type: 'select', options: yesNoNotDocumented, source: 'History in patient file' },
      { name: 'asaClass', label: 'ASA class', type: 'select', options: ['I', 'II', 'III', 'IV', 'V'], source: 'Anesthesia chart' },
      { name: 'preExistingRespiratoryDisease', label: 'Pre-existing respiratory disease', type: 'select', options: yesNo, source: 'History in file' },
      { name: 'copdAsthma', label: 'COPD / asthma', type: 'select', options: yesNo, source: 'History in file' },
      { name: 'cardiovascularDisease', label: 'Cardiovascular disease', type: 'select', options: yesNo, source: 'History in file' },
      { name: 'hypertension', label: 'Hypertension', type: 'select', options: yesNo, source: 'History in file' },
      { name: 'diabetesMellitus', label: 'Diabetes mellitus', type: 'select', options: yesNo, source: 'History in file' },
      { name: 'renalDisease', label: 'Renal disease', type: 'select', options: yesNo, source: 'History in file' },
      { name: 'hivStatus', label: 'HIV status', type: 'select', options: ['Positive', 'Negative', 'Unknown'], source: 'OpenMRS / file' },
      { name: 'anemia', label: 'Anemia', type: 'select', options: yesNo, source: 'Lab chart / file' },
      { name: 'obesity', label: 'Obesity', type: 'select', options: yesNo, source: 'Derived / file' },
      { name: 'sleepApnea', label: 'Sleep apnea', type: 'select', options: yesNoNotDocumented, source: 'History in file' },
      { name: 'baselineSpo2', label: 'Baseline room-air SpO2', type: 'number', suffix: '%', source: 'Preoperative chart / nursing chart' },
      { name: 'baselineRespiratoryRate', label: 'Baseline respiratory rate', type: 'number', suffix: 'breaths/min', source: 'Preoperative chart' },
      { name: 'baselineHeartRate', label: 'Baseline heart rate', type: 'number', suffix: 'beats/min', source: 'Preoperative chart' },
      { name: 'baselineSystolicBp', label: 'Baseline systolic BP', type: 'number', suffix: 'mmHg', source: 'Preoperative chart' },
      { name: 'baselineDiastolicBp', label: 'Baseline diastolic BP', type: 'number', suffix: 'mmHg', source: 'Preoperative chart' },
      { name: 'preoperativeHemoglobin', label: 'Preoperative hemoglobin', type: 'number', suffix: 'g/dL', source: 'Lab chart' },
      { name: 'otherPreoperativeLabs', label: 'Other relevant preoperative laboratory values', type: 'textarea', source: 'Lab chart' },
    ],
  },
  {
    title: 'B2. Surgery-related variables',
    description: 'Surgical specialty, procedure details, urgency, approach, duration, blood loss, and positioning.',
    fields: [
      { name: 'surgicalSpecialty', label: 'Surgical specialty', type: 'select', options: ['General surgery', 'Orthopedics', 'Obstetrics-gynecology', 'ENT', 'Other'], source: 'Theatre register / file' },
      { name: 'surgeryType', label: 'Type of surgery', source: 'Theatre register / file' },
      { name: 'procedurePerformed', label: 'Procedure performed', type: 'textarea', source: 'Operation notes' },
      { name: 'urgency', label: 'Surgery status', type: 'select', options: ['Elective', 'Emergency'], source: 'Theatre register / file' },
      { name: 'majorMinorSurgery', label: 'Major or minor surgery', type: 'select', options: ['Major', 'Minor'], source: 'Operation notes' },
      { name: 'surgicalApproach', label: 'Surgical approach', type: 'select', options: ['Open', 'Minimally invasive', 'Other'], source: 'Operation notes' },
      { name: 'incisionType', label: 'Incision type, if relevant', source: 'Operation notes' },
      { name: 'duration', label: 'Duration of surgery', type: 'number', suffix: 'min', source: 'Theatre register / anesthesia chart' },
      { name: 'estimatedBloodLoss', label: 'Estimated blood loss', type: 'number', suffix: 'mL', source: 'Operation note / anesthesia chart' },
      { name: 'bloodLoss', label: 'Blood loss category', type: 'select', options: ['Low', 'Moderate', 'High'], source: 'Operation note / anesthesia chart' },
      { name: 'bloodTransfusion', label: 'Blood transfusion given', type: 'select', options: yesNo, source: 'Anesthesia chart / file' },
      { name: 'patientPosition', label: 'Patient position during surgery', type: 'select', options: ['Supine', 'Prone', 'Lateral', 'Lithotomy', 'Other'], source: 'Anesthesia chart' },
    ],
  },
  {
    title: 'B3. Anesthesia-related variables',
    description: 'Anesthesia type, airway, medications, intraoperative events, fluids, and vasopressor exposure.',
    fields: [
      { name: 'anesthesiaType', label: 'Type of anesthesia', type: 'select', options: ['General', 'Spinal', 'Regional', 'Combined', 'Other'], source: 'Anesthesia chart' },
      { name: 'airwayType', label: 'Airway type', type: 'select', options: ['Endotracheal tube', 'Laryngeal mask airway', 'Face mask', 'Other'], source: 'Anesthesia chart' },
      { name: 'intraoperativeOpioidUse', label: 'Intraoperative opioid use', type: 'select', options: yesNo, source: 'Anesthesia chart' },
      { name: 'totalOpioidDose', label: 'Total opioid dose', source: 'Anesthesia chart' },
      { name: 'sedativeUse', label: 'Sedative use', type: 'select', options: yesNo, source: 'Anesthesia chart' },
      { name: 'muscleRelaxantUsed', label: 'Muscle relaxant used', type: 'select', options: yesNo, source: 'Anesthesia chart' },
      { name: 'reversalAgentUsed', label: 'Reversal agent used', type: 'select', options: yesNo, source: 'Anesthesia chart' },
      { name: 'intraoperativeHypotension', label: 'Intraoperative hypotension', type: 'select', options: yesNo, source: 'Anesthesia chart' },
      { name: 'intraoperativeBronchospasm', label: 'Intraoperative wheezing / bronchospasm', type: 'select', options: yesNo, source: 'Anesthesia chart' },
      { name: 'intraoperativeDesaturation', label: 'Intraoperative desaturation episode', type: 'select', options: yesNo, source: 'Anesthesia chart' },
      { name: 'intraoperativeSpo2', label: 'Intraoperative SpO2', type: 'number', suffix: '%', source: 'Anesthesia chart' },
      { name: 'intraoperativeFluidVolume', label: 'Intraoperative fluid volume', type: 'number', suffix: 'mL', source: 'Anesthesia chart' },
      { name: 'vasopressorUsed', label: 'Vasopressor used', type: 'select', options: yesNo, source: 'Anesthesia chart' },
    ],
  },
  {
    title: 'B4. Immediate postoperative variables',
    description: 'PACU/recovery observations and first 24-hour respiratory status used for oxygen-risk prediction.',
    fields: [
      { name: 'pacuAdmissionSpo2', label: 'PACU/recovery admission SpO2', type: 'number', suffix: '%', source: 'Recovery chart' },
      { name: 'pacuDischargeSpo2', label: 'PACU/recovery discharge SpO2', type: 'number', suffix: '%', source: 'Recovery chart' },
      { name: 'postoperativeRespiratoryRate', label: 'Postoperative respiratory rate', type: 'number', suffix: 'breaths/min', source: 'Recovery / nursing chart' },
      { name: 'postoperativeHeartRate', label: 'Postoperative heart rate', type: 'number', suffix: 'beats/min', source: 'Recovery / nursing chart' },
      { name: 'postoperativeSystolicBp', label: 'Postoperative systolic BP', type: 'number', suffix: 'mmHg', source: 'Recovery / nursing chart' },
      { name: 'postoperativeDiastolicBp', label: 'Postoperative diastolic BP', type: 'number', suffix: 'mmHg', source: 'Recovery / nursing chart' },
      { name: 'temperature', label: 'Temperature', type: 'number', suffix: 'C', source: 'Recovery / nursing chart' },
      { name: 'consciousness', label: 'Level of consciousness', type: 'select', options: ['Alert', 'Responds to voice', 'Responds to pain', 'Unresponsive'], source: 'Recovery chart' },
      { name: 'painScore', label: 'Pain score', type: 'number', source: 'Recovery chart' },
      { name: 'respiratoryDistressSigns', label: 'Respiratory distress signs', type: 'select', options: yesNo, source: 'Recovery / nursing chart' },
      { name: 'wheezeOrStridor', label: 'Wheeze or stridor', type: 'select', options: yesNo, source: 'Recovery / nursing chart' },
      { name: 'lowestPostopSpo2', label: 'Lowest postoperative SpO2 within first 24 h', type: 'number', suffix: '%', source: 'Recovery / nursing chart' },
      { name: 'deepBreathingCough', label: 'Ability to breathe deeply / cough', type: 'select', options: yesNoNotDocumented, source: 'Nursing chart' },
      { name: 'timeSinceSurgery', label: 'Time since surgery', type: 'number', suffix: 'min', source: 'Recovery / nursing chart' },
      { name: 'oxygenBeforePrediction', label: 'Oxygen before prediction', type: 'select', options: yesNo, source: 'Recovery / nursing chart' },
    ],
  },
]

export default function NewPredictionContent() {
  const [mode, setMode] = useState('new')
  const [form, setForm] = useState(initialForm)
  const [datasetName, setDatasetName] = useState('')
  const [targetColumn, setTargetColumn] = useState('primaryOutcome')
  const [modelType, setModelType] = useState('xgboost')
  const [datasetFile, setDatasetFile] = useState(null)
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
      hospitalId: patient.hospital_id || current.hospitalId,
      age: patient.age ? String(patient.age) : current.age,
      sex: patient.sex || current.sex,
      smokingHistory: patient.smoking_history ? 'Yes' : 'No',
      baselineSpo2: patient.baseline_spo2 ? String(patient.baseline_spo2) : current.baselineSpo2,
      surgeryType: record.surgery_type || current.surgeryType,
      urgency: record.urgency ? capitalize(record.urgency) : current.urgency,
      duration: record.surgery_duration ? String(record.surgery_duration) : current.duration,
      bloodLoss: record.blood_loss || current.bloodLoss,
      wardService: record.ward || current.wardService,
      surgeryDate: record.procedure_date || current.surgeryDate,
      anesthesiaType: record.anesthesia_type || current.anesthesiaType,
      asaClass: record.asa_class || current.asaClass,
      pacuAdmissionSpo2: record.postop_spo2 ? String(record.postop_spo2) : current.pacuAdmissionSpo2,
      postoperativeRespiratoryRate: record.respiratory_rate ? String(record.respiratory_rate) : current.postoperativeRespiratoryRate,
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
    try {
      const postopSpo2 = form.lowestPostopSpo2 || form.pacuAdmissionSpo2
      const respiratoryEvents = [
        form.airwayType,
        form.intraoperativeBronchospasm === 'Yes' ? 'bronchospasm' : '',
        form.intraoperativeDesaturation === 'Yes' ? 'desaturation' : '',
        form.wheezeOrStridor === 'Yes' ? 'wheeze or stridor' : '',
      ].filter(Boolean).join(', ')

      const resp = await fetch(`${API_URL}/patient-assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
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
          ward: form.wardService,
          procedure_date: form.surgeryDate,
          anesthesia_type: form.anesthesiaType,
          asa_class: form.asaClass,
          opioid_use: form.intraoperativeOpioidUse,
          airway_event: respiratoryEvents,
          recovery_status: form.respiratoryDistressSigns === 'Yes' ? 'Respiratory distress' : '',
          postop_spo2: postopSpo2,
          respiratory_rate: form.postoperativeRespiratoryRate,
          pain_status: form.painScore,
          consciousness: form.consciousness,
          time_since_surgery: form.timeSinceSurgery,
          oxygen_before_prediction: form.oxygenBeforePrediction,
          generate_prediction: generatePrediction,
        }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setStatusMessage(data.error || 'Could not save assessment.')
        return
      }
      if (generatePrediction && data.prediction) {
        setPredictionResult(data.prediction)
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
              Postoperative oxygen assessment form
            </h1>
            <p className="mt-2 max-w-[760px] text-[16px] leading-7 text-[#53668a]">
              Capture screening, patient, surgery, anesthesia, PACU, and outcome variables for oxygen requirement prediction.
            </p>
          </div>

          <div className="grid gap-2 rounded-[14px] bg-[#eef4fb] p-1 sm:grid-cols-3">
            <ModeButton active={mode === 'new'} onClick={() => setMode('new')}>Create new patient</ModeButton>
            <ModeButton active={mode === 'existing'} onClick={() => setMode('existing')}>Existing patient</ModeButton>
            <ModeButton active={mode === 'dataset'} onClick={() => setMode('dataset')}>Add dataset</ModeButton>
          </div>
        </div>
      </section>

      {mode === 'existing' && (
        <section className="rounded-[16px] border border-[#c7d8eb] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.07)] md:px-6">
          <h2 className="text-[22px] font-black text-[#071b49]">Fetch patient data From EMR</h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              className="min-h-[48px] flex-1 rounded-[16px] border border-[#c7d8eb] bg-white px-4 text-[16px] font-semibold text-[#071b49] outline-none focus:border-[#1768f2]"
              placeholder="Search by coded ID"
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
          {formSections.map((section) => (
            <FormPanel key={section.title} title={section.title} description={section.description}>
              {section.fields.map((field) => (
                <FieldRenderer
                  key={field.name}
                  field={field}
                  value={field.type === 'readonly' && field.name === 'bmi' ? (bmi ? `${bmi} kg/m2` : 'Enter height and weight') : form[field.name]}
                  onChange={(value) => updateField(field.name, value)}
                />
              ))}
            </FormPanel>
          ))}

          <section className="rounded-[16px] border border-[#e2eaf5] bg-white/95 px-4 py-4 shadow-[0_16px_36px_rgba(13,28,61,0.12)] backdrop-blur sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-[14px] font-bold text-[#53668a]">
                Prediction uses age, sex, BMI, smoking history, baseline SpO2, surgery, anesthesia, ASA, PACU SpO2, respiratory rate, and oxygen status.
              </p>
              <div className="grid gap-3 sm:min-w-[520px] sm:grid-cols-2">
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
            </div>
          </section>

          {predictionResult && (
            <PredictionResultPanel prediction={predictionResult} />
          )}
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

function ModeButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[12px] px-5 py-3 text-[15px] font-extrabold transition ${
        active ? 'bg-white text-[#071b49] shadow-sm' : 'text-[#53668a] hover:text-[#071b49]'
      }`}
    >
      {children}
    </button>
  )
}

function FormPanel({ title, description, children }) {
  return (
    <section className="min-w-0 rounded-[20px] border border-[#cfdded] bg-[#f8fbff] px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.05)] md:px-6">
      <div className="max-w-[880px]">
        <h2 className="text-[24px] font-black text-[#071b49] md:text-[26px]">{title}</h2>
        {description && <p className="mt-2 text-[15px] leading-6 text-[#53668a]">{description}</p>}
      </div>
      <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  )
}

function PredictionResultPanel({ prediction }) {
  const probability = Math.round(Number(prediction.predicted_probability || 0) * 100)
  const riskLevel = prediction.risk_level || 'Pending'
  const oxygenRequired = prediction.predicted_class || (probability >= 50 ? 'Yes' : 'No')
  const recommendation = dispositionRecommendation(riskLevel)
  const tone = recommendationTone(riskLevel)
  const outcomeFields = [
    ['Postoperative oxygen requirement', oxygenRequired],
    ['Time to first oxygen after surgery', recommendation.timeToOxygen],
    ['Reason for oxygen initiation', recommendation.oxygenReason],
    ['Postoperative oxygen device', recommendation.oxygenDevice],
    ['Oxygen quantity', recommendation.oxygenQuantity],
    ['Duration of oxygen therapy', 'To be recorded from recovery / nursing chart'],
    ['Escalation of respiratory support', recommendation.escalationSupport],
    ['ICU/HDU transfer', recommendation.unit],
    ['Mechanical ventilation required', recommendation.mechanicalVentilation],
    ['Postoperative death / in-hospital death', 'Not predicted'],
  ]

  return (
    <section className={`rounded-[20px] border px-5 py-5 shadow-[0_12px_30px_rgba(13,28,61,0.08)] md:px-6 ${tone.panel}`}>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className={`text-[13px] font-extrabold uppercase tracking-[0.14em] ${tone.eyebrow}`}>Generated prediction result</p>
          <h2 className="mt-2 text-[28px] font-black text-[#071b49]">
            Section C. Outcome variables
          </h2>
          <p className="mt-2 max-w-[760px] text-[16px] leading-7 text-[#53668a]">
            Generated after prediction. {riskLevel} risk with recommended postoperative destination:
            <span className="font-black text-[#071b49]"> {recommendation.unit}</span>. {recommendation.detail}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
          <ResultMetric label="Probability" value={`${Number.isFinite(probability) ? probability : 0}%`} />
          <ResultMetric label="Recommended unit" value={recommendation.unit} />
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {outcomeFields.map(([label, value]) => (
          <GeneratedOutcomeField key={label} label={label} value={value} />
        ))}
      </div>

      {!!prediction.contributing_factors?.length && (
        <div className="mt-5 rounded-[16px] border border-white/70 bg-white/70 p-4">
          <h3 className="text-[16px] font-black text-[#071b49]">Key contributing factors</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {prediction.contributing_factors.map((factor, index) => (
              <span key={`${factor.feature || factor.display || index}`} className="rounded-full bg-white px-3 py-2 text-[13px] font-bold text-[#20365f] shadow-sm">
                {factor.display || factor.feature || factor}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function GeneratedOutcomeField({ label, value }) {
  return (
    <div className="min-w-0">
      <span className="mb-2 block text-[14px] font-bold text-[#6c7f9f]">{label}</span>
      <div className="flex min-h-[50px] items-center rounded-[16px] border border-white/70 bg-white/80 px-4 text-[15px] font-black text-[#071b49]">
        {value || 'Not predicted'}
      </div>
    </div>
  )
}

function ResultMetric({ label, value }) {
  return (
    <div className="rounded-[16px] border border-white/70 bg-white/80 px-4 py-4">
      <p className="text-[13px] font-bold text-[#6c7f9f]">{label}</p>
      <p className="mt-1 text-[24px] font-black text-[#071b49]">{value}</p>
    </div>
  )
}

function dispositionRecommendation(riskLevel) {
  const normalizedRisk = String(riskLevel || '').toLowerCase()
  if (normalizedRisk.includes('high')) {
    return {
      unit: 'ICU',
      detail: ' Arrange ICU review and close respiratory monitoring after surgery.',
      timeToOxygen: 'Immediate postoperative oxygen review',
      oxygenReason: 'High-risk prediction',
      oxygenDevice: 'Clinician to select based on SpO2 and distress',
      oxygenQuantity: 'Titrate to target SpO2 per protocol',
      escalationSupport: 'Yes',
      mechanicalVentilation: 'Assess in ICU if clinically indicated',
    }
  }
  if (normalizedRisk.includes('moderate')) {
    return {
      unit: 'HDU',
      detail: ' Continue enhanced monitoring and oxygen readiness in HDU.',
      timeToOxygen: 'Early postoperative reassessment',
      oxygenReason: 'Moderate-risk prediction',
      oxygenDevice: 'Nasal cannula or face mask if indicated',
      oxygenQuantity: 'Start per protocol if SpO2 drops',
      escalationSupport: 'Yes',
      mechanicalVentilation: 'No, unless clinical deterioration occurs',
    }
  }
  return {
    unit: 'Ward',
    detail: ' Continue routine ward observation and repeat vital signs as documented.',
    timeToOxygen: 'Not required by prediction',
    oxygenReason: 'Lower-risk prediction',
    oxygenDevice: 'Not required by prediction',
    oxygenQuantity: 'Not required by prediction',
    escalationSupport: 'No',
    mechanicalVentilation: 'No',
  }
}

function recommendationTone(riskLevel) {
  const normalizedRisk = String(riskLevel || '').toLowerCase()
  if (normalizedRisk.includes('high')) {
    return {
      panel: 'border-[#fecaca] bg-[#fff7f7]',
      eyebrow: 'text-[#dc2626]',
    }
  }
  if (normalizedRisk.includes('moderate')) {
    return {
      panel: 'border-[#fde68a] bg-[#fffbea]',
      eyebrow: 'text-[#b45309]',
    }
  }
  return {
    panel: 'border-[#bbf7d0] bg-[#f2fff7]',
    eyebrow: 'text-[#15803d]',
  }
}

function FieldRenderer({ field, value, onChange }) {
  if (field.type === 'readonly') {
    return <ReadOnlyField label={field.label} value={value} source={field.source} />
  }

  if (field.type === 'select') {
    return <SelectField label={field.label} value={value} onChange={onChange} options={field.options} source={field.source} />
  }

  if (field.type === 'textarea') {
    return <TextAreaField label={field.label} value={value} onChange={onChange} source={field.source} />
  }

  return (
    <FormField
      label={field.label}
      value={value}
      onChange={onChange}
      suffix={field.suffix}
      type={field.type || 'text'}
      source={field.source}
    />
  )
}

function SourceText({ source }) {
  if (!source) return null
  return <span className="mt-1 block text-[12px] font-semibold leading-5 text-[#8a9bb6]">Source: {source}</span>
}

function FormField({ label, value, onChange, suffix, type = 'text', source }) {
  return (
    <label className="min-w-0">
      <span className="mb-2 block text-[14px] font-bold text-[#6c7f9f]">{label}</span>
      <div className="flex min-h-[50px] items-center rounded-[16px] border border-[#c7d8eb] bg-white px-4 focus-within:border-[#1768f2]">
        <input
          className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold text-[#071b49] outline-none"
          type={type}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && <span className="ml-2 shrink-0 text-[13px] font-bold text-[#6c7f9f]">{suffix}</span>}
      </div>
      <SourceText source={source} />
    </label>
  )
}

function TextAreaField({ label, value, onChange, source }) {
  return (
    <label className="min-w-0 xl:col-span-2">
      <span className="mb-2 block text-[14px] font-bold text-[#6c7f9f]">{label}</span>
      <textarea
        className="min-h-[96px] w-full rounded-[16px] border border-[#c7d8eb] bg-white px-4 py-3 text-[16px] font-semibold text-[#071b49] outline-none focus:border-[#1768f2]"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      />
      <SourceText source={source} />
    </label>
  )
}

function SelectField({ label, value, onChange, options, source }) {
  return (
    <label className="min-w-0">
      <span className="mb-2 block text-[14px] font-bold text-[#6c7f9f]">{label}</span>
      <select
        className="min-h-[50px] w-full rounded-[16px] border border-[#c7d8eb] bg-white px-4 text-[16px] font-semibold text-[#071b49] outline-none focus:border-[#1768f2]"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option || 'blank'} value={option}>{option || 'Not recorded'}</option>
        ))}
      </select>
      <SourceText source={source} />
    </label>
  )
}

function ReadOnlyField({ label, value, source }) {
  return (
    <div className="min-w-0">
      <span className="mb-2 block text-[14px] font-bold text-[#6c7f9f]">{label}</span>
      <div className="flex min-h-[50px] items-center rounded-[16px] border border-[#c7d8eb] bg-[#eef4fb] px-4 text-[16px] font-black text-[#071b49]">
        {value}
      </div>
      <SourceText source={source} />
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
            Upload a CSV dataset with the revised study variables and the Objective 2 oxygen outcome.
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
            Select a CSV file containing patient, surgery, anesthesia, postoperative, and oxygen outcome columns.
          </p>
        </label>

        <div className="space-y-4 rounded-[18px] border border-[#cfdded] bg-[#f8fbff] p-5">
          <FormField label="Dataset name" value={datasetName} onChange={setDatasetName} />
          <FormField label="Target column" value={targetColumn} onChange={setTargetColumn} />
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
            {loading ? 'Uploading...' : 'Upload and train'}
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
