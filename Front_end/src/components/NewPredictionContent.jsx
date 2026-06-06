import React, { useEffect, useMemo, useRef, useState } from 'react'
import { clearCurrentSession, getSession } from '../authSession.js'
import { notifyPredictionHistoryUpdated } from '../predictionEvents.js'
import { API_BASE_URL } from '../config/api.js'

const yesNo = ['No', 'Yes']
const yesNoUnknown = ['No', 'Yes', 'Not documented']
const requiredPredictionFields = [
  ['patientCodedId', 'Patient Hospital ID'],
  ['age', 'Age'],
  ['sex', 'Sex'],
  ['weight', 'Weight'],
  ['height', 'Height'],
  ['smokingHistory', 'Smoking history'],
  ['asaClass', 'ASA class'],
  ['preExistingRespiratoryDisease', 'Pre-existing respiratory disease'],
  ['copdAsthma', 'COPD / asthma'],
  ['cardiovascularDisease', 'Cardiovascular disease'],
  ['hypertension', 'Hypertension'],
  ['diabetesMellitus', 'Diabetes mellitus'],
  ['renalDisease', 'Renal disease'],
  ['hivStatus', 'HIV status'],
  ['anemia', 'Anemia'],
  ['obesity', 'Obesity'],
  ['sleepApnea', 'Sleep apnea'],
  ['baselineSpo2', 'Baseline room-air SpO2'],
  ['baselineRespiratoryRate', 'Baseline respiratory rate'],
  ['surgicalSpecialty', 'Expected surgical specialty'],
  ['typeOfSurgery', 'Expected type of surgery'],
  ['surgeryStatus', 'Expected surgery status'],
  ['surgeryMagnitude', 'Expected major or minor surgery'],
  ['surgicalApproach', 'Expected surgical approach'],
  ['durationOfSurgery', 'Expected duration of surgery'],
  ['estimatedBloodLoss', 'Expected estimated blood loss'],
  ['typeOfAnesthesia', 'Expected type of anesthesia'],
  ['airwayType', 'Expected airway type'],
  ['intraoperativeOpioidUse', 'Expected intraoperative opioid use'],
  ['sedativeUse', 'Expected sedative use'],
  ['muscleRelaxantUsed', 'Expected muscle relaxant use'],
  ['reversalAgentUsed', 'Expected reversal agent use'],
  ['intraoperativeHypotension', 'Expected intraoperative hypotension risk'],
  ['intraoperativeBronchospasm', 'Expected intraoperative wheezing / bronchospasm risk'],
  ['intraoperativeDesaturation', 'Expected intraoperative desaturation risk'],
  ['intraoperativeFluidVolume', 'Expected intraoperative fluid volume'],
  ['vasopressorUsed', 'Expected vasopressor use'],
]
const requiredPredictionFieldMap = new Map(requiredPredictionFields)

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
    title: 'B2. Expected surgery-related variables',
    columns: 3,
    fields: [
      field('surgicalSpecialty', 'Expected surgical specialty', 'select', ['General surgery', 'Orthopedics', 'Obstetrics-gynecology', 'ENT', 'Other'], 'Planned theatre register / file', null, 'General surgery=1, Orthopedics=2, Obstetrics-gynecology=3, ENT=4, Other=5'),
      field('typeOfSurgery', 'Expected type of surgery', 'text', null, 'Planned theatre register / file', null, 'Numeric code'),
      field('procedurePerformed', 'Expected procedure to be performed', 'textarea', null, 'Surgical plan / theatre booking', null, 'Numeric code or free text'),
      field('surgeryStatus', 'Expected surgery status', 'select', ['Elective', 'Emergency'], 'Planned theatre register / file', null, 'Elective=1, Emergency=2'),
      field('surgeryMagnitude', 'Expected major or minor surgery', 'select', ['Major', 'Minor'], 'Surgical plan / theatre booking', null, 'Major=1, Minor=2'),
      field('surgicalApproach', 'Expected surgical approach', 'select', ['Open', 'Minimally invasive', 'Other'], 'Surgical plan / theatre booking', null, 'Open=1, Minimally invasive=2, Other=3'),
      field('incisionType', 'Expected incision type, if relevant', 'text', null, 'Surgical plan / theatre booking', null, 'Numerical coding'),
      field('durationOfSurgery', 'Expected duration of surgery', 'number', null, 'Planned theatre register / anesthesia plan', 'min', 'Continuous'),
      field('estimatedBloodLoss', 'Expected estimated blood loss', 'number', null, 'Surgical plan / anesthesia plan', 'mL', 'Continuous'),
      field('bloodTransfusionGiven', 'Expected blood transfusion', 'select', yesNo, 'Anesthesia plan / file', null, 'Yes=1, No=0'),
      field('patientPosition', 'Expected patient position during surgery', 'select', ['Supine', 'Prone', 'Lateral', 'Lithotomy', 'Other'], 'Anesthesia plan', null, 'Supine=1, Prone=2, Lateral=3, Lithotomy=4, Other=5'),
    ],
  },
  {
    title: 'B3. Expected anesthesia and intraoperative variables',
    columns: 3,
    fields: [
      field('typeOfAnesthesia', 'Expected type of anesthesia', 'select', ['General', 'Spinal', 'Regional', 'Combined', 'Other'], 'Anesthesia plan', null, 'General=1, Spinal=2, Regional=3, Combined=4, Other=5'),
      field('airwayType', 'Expected airway type', 'select', ['Endotracheal tube', 'Laryngeal mask airway', 'Face mask', 'Other'], 'Anesthesia plan', null, 'Endotracheal tube=1, Laryngeal mask airway=2, Face mask=3, Other=4'),
      field('intraoperativeOpioidUse', 'Expected intraoperative opioid use', 'select', yesNo, 'Anesthesia plan', null, 'Yes=1, No=0'),
      field('sedativeUse', 'Expected sedative use', 'select', yesNo, 'Anesthesia plan', null, 'Yes=1, No=0'),
      field('muscleRelaxantUsed', 'Expected muscle relaxant use', 'select', yesNo, 'Anesthesia plan', null, 'Yes=1, No=0'),
      field('reversalAgentUsed', 'Expected reversal agent use', 'select', yesNo, 'Anesthesia plan', null, 'Yes=1, No=0'),
      field('intraoperativeHypotension', 'Expected intraoperative hypotension risk', 'select', yesNo, 'Anesthesia plan / preoperative assessment', null, 'Yes=1, No=0'),
      field('intraoperativeBronchospasm', 'Expected intraoperative wheezing / bronchospasm risk', 'select', yesNo, 'Anesthesia plan / preoperative assessment', null, 'Yes=1, No=0'),
      field('intraoperativeDesaturation', 'Expected intraoperative desaturation risk', 'select', yesNo, 'Anesthesia plan / preoperative assessment', null, 'Yes=1, No=0'),
      field('intraoperativeFluidVolume', 'Expected intraoperative fluid volume', 'number', null, 'Anesthesia plan', 'mL', 'Continuous'),
      field('vasopressorUsed', 'Expected vasopressor use', 'select', yesNo, 'Anesthesia plan', null, 'Yes=1, No=0'),
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
  const [datasetPredictionReport, setDatasetPredictionReport] = useState(null)
  const [hasGeneratedPrediction, setHasGeneratedPrediction] = useState(false)
  const [syncingPrediction, setSyncingPrediction] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const lastSyncedPayloadRef = useRef('')

  function handleExpiredBackendSession() {
    clearCurrentSession()
    window.location.href = '/login'
  }

  const bmi = useMemo(() => {
    const heightM = Number(form.height) / 100
    const weightKg = Number(form.weight)
    if (!heightM || !weightKg) return ''
    return (weightKg / (heightM * heightM)).toFixed(1)
  }, [form.height, form.weight])

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  useEffect(() => {
    if (!hasGeneratedPrediction || mode === 'dataset' || actionLoading === 'prediction') return undefined

    const missingFields = validatePredictionFields(form, bmi)
    if (missingFields.length > 0) {
      setError(`Complete required fields before updating the prediction: ${missingFields.join(', ')}.`)
      return undefined
    }

    const features = buildPredictionPayload(form, bmi)
    const payloadSignature = JSON.stringify({ features, modelType })
    if (payloadSignature === lastSyncedPayloadRef.current) return undefined

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      const session = getSession()
      setSyncingPrediction(true)
      setError('')

      try {
        const resp = await fetch(`${API_BASE_URL}/predict`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.token || ''}`,
            'X-User-Email': session?.email || '',
          },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({ features, model_type: modelType, persist: false }),
        })
        const data = await resp.json()
        if (!resp.ok) {
          if (resp.status === 401) {
            handleExpiredBackendSession()
            return
          }
          throw new Error(data.error || 'Could not update prediction.')
        }

        lastSyncedPayloadRef.current = payloadSignature
        setPredictionResult(data)
      } catch (error) {
        if (error.name === 'AbortError') return
        console.error(error)
        setError(error.message || 'Could not update prediction from the backend.')
      } finally {
        setSyncingPrediction(false)
      }
    }, 600)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [actionLoading, bmi, form, hasGeneratedPrediction, mode, modelType])

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
      const resp = await fetch(`${API_BASE_URL}/patients/search?q=${encodeURIComponent(existingSearch)}`, { credentials: 'include' })
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
    setActionLoading(generatePrediction ? 'prediction' : 'draft')
    setStatusMessage('')
    setError('')
    if (!generatePrediction) {
      setPredictionResult(null)
      setHasGeneratedPrediction(false)
      lastSyncedPayloadRef.current = ''
    }

    const draft = { ...form, bmi }
    try {
      localStorage.setItem('postopOxygenPredictionDraft', JSON.stringify(draft))

      if (!generatePrediction) {
        setStatusMessage('Draft saved in this browser.')
        return
      }

      const missingFields = validatePredictionFields(form, bmi)
      if (missingFields.length > 0) {
        setError(`Complete required fields before generating a prediction: ${missingFields.join(', ')}.`)
        return
      }

      setLoading(true)
      setPredictionResult(null)

      const session = getSession()
      const features = buildPredictionPayload(form, bmi)
      const payloadSignature = JSON.stringify({ features, modelType })
      const resp = await fetch(`${API_BASE_URL}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.token || ''}`,
          'X-User-Email': session?.email || '',
        },
        credentials: 'include',
        body: JSON.stringify({ features, model_type: modelType, persist: true }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        if (resp.status === 401) {
          handleExpiredBackendSession()
          return
        }
        setError(data.error || 'Could not generate prediction.')
        return
      }
      lastSyncedPayloadRef.current = payloadSignature
      setPredictionResult(data)
      setHasGeneratedPrediction(true)
      notifyPredictionHistoryUpdated(data)
      setStatusMessage('')
    } catch (error) {
      console.error(error)
      setError(generatePrediction ? 'Could not generate prediction. Check that the backend is running and try again.' : 'Could not save draft.')
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
    setDatasetPredictionReport(null)

    if (!file) return

    const columns = await extractDatasetColumns(file)
    setDatasetColumns(columns)
    if (columns.length > 0) {
      setTargetColumn(defaultTargetColumn(columns))
      setStatusMessage('')
    }
    if (columns.length === 0) setStatusMessage('Columns will be detected by the backend after upload. Excel files require backend openpyxl support.')
  }

  async function uploadAndPredictDataset() {
    if (!datasetFile) {
      setStatusMessage('Choose a dataset file first.')
      return
    }

    setLoading(true)
    setStatusMessage('')
    try {
      const session = getSession()
      const fd = new FormData()
      fd.append('file', datasetFile)
      const authHeaders = {
        Authorization: `Bearer ${session?.token || ''}`,
        'X-User-Email': session?.email || '',
      }
      const uploadResp = await fetch(`${API_BASE_URL}/upload-prediction-dataset`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
        headers: authHeaders,
      })
      const uploadData = await uploadResp.json()
      if (!uploadResp.ok) {
        setStatusMessage(uploadData.error || 'Could not upload dataset.')
        return
      }

      const uploadedColumns = Array.isArray(uploadData.columns) ? uploadData.columns : []
      if (uploadedColumns.length > 0) setDatasetColumns(uploadedColumns)
      const selectedTargetColumn = targetColumn || defaultTargetColumn(uploadedColumns)
      if (!selectedTargetColumn) {
        setStatusMessage(uploadData.column_error || 'Select the target column from the dataset.')
        return
      }
      setTargetColumn(selectedTargetColumn)

      const predictResp = await fetch(`${API_BASE_URL}/predict-dataset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
        body: JSON.stringify({
          dataset_path: uploadData.dataset_path,
          target_column: selectedTargetColumn,
        }),
      })
      const predictionData = await predictResp.json()
      if (!predictResp.ok) {
        setStatusMessage(predictionData.error || 'Could not run dataset prediction.')
        return
      }

      const summary = predictionData.summary || {}
      const firstPrediction = Array.isArray(predictionData.predictions) ? predictionData.predictions[0] : null
      setStatusMessage(`Prediction complete for ${summary.predicted_rows || 0} rows in ${datasetName}.`)
      setDatasetPredictionReport({
        datasetName,
        targetColumn: selectedTargetColumn,
        activeModel: summary.active_model || firstPrediction?.active_model,
        modelType: summary.model_type || firstPrediction?.model_type,
        trainingMetrics: summary.training_metrics || firstPrediction?.training_metrics || {},
        predictionStatus: 'Prediction complete',
        rowCount: summary.total_rows,
        predictedRows: summary.predicted_rows,
        highRiskRows: summary.high_risk_rows,
        moderateRiskRows: summary.moderate_risk_rows,
        lowRiskRows: summary.low_risk_rows,
        probability: firstPrediction?.predicted_probability,
        riskLevel: firstPrediction?.risk_level,
      })
    } catch (error) {
      console.error(error)
      setStatusMessage('Could not upload and predict from dataset.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="prediction-form-16 container-fluid min-w-0 px-0">
      <section className="card border-0 shadow-sm rounded-4 mb-3 rounded-[16px] border border-[#d7e2ef] bg-white px-5 py-5 md:px-6">
        <div className="card-body p-0 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="small-text text-primary fw-bold text-uppercase mb-2 font-extrabold tracking-[0.14em]">New Prediction</p>
            <h1 className="page-title fw-black mb-2 mt-2 font-black text-[#071b49]">
              Postoperative oxygen prediction form
            </h1>
            <p className="body-text mb-0 text-secondary mt-2 max-w-[720px]">
              Capture screening details and candidate predictors before generating an oxygen requirement risk estimate.
            </p>
          </div>

          <div className="btn-group flex-wrap grid gap-2 rounded-[14px] bg-[#eef4fb] p-1 sm:grid-cols-3" role="group" aria-label="Prediction mode">
            <ModeButton active={mode === 'new'} onClick={() => setMode('new')}>Prediction form</ModeButton>
            <ModeButton active={mode === 'existing'} onClick={() => setMode('existing')}>Existing patient</ModeButton>
            <ModeButton active={mode === 'dataset'} onClick={() => setMode('dataset')}>Add dataset</ModeButton>
          </div>
        </div>
      </section>

      {mode === 'existing' && (
        <section className="card border-0 shadow-sm rounded-4 mb-3 rounded-[16px] border border-[#c7d8eb] bg-white px-5 py-5 md:px-6">
          <h2 className="section-title fw-bold h4 font-black text-[#071b49]">Search by patient Hospital ID</h2>
          <div className="input-group input-group-lg mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              className="form-control min-h-[48px] flex-1 rounded-[10px] border border-[#c7d8eb] bg-white px-4 text-[16px] font-semibold text-[#071b49] outline-none focus:border-[#1768f2]"
              placeholder="Enter Patient Hospital ID to fetch data from Hospital EMR"
              value={existingSearch}
              onChange={(event) => setExistingSearch(event.target.value)}
            />
            <button
              onClick={loadExistingPatient}
              disabled={loading}
              className="btn-text btn btn-dark fw-bold rounded-[10px] px-6 py-3 font-extrabold text-white disabled:opacity-70"
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
          onDatasetFileChange={handleDatasetFile}
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

          <section className="card border-0 shadow-sm rounded-4 mb-3 rounded-[16px] border border-[#e2eaf5] bg-white px-4 py-4 sm:px-5">
            <div className="grid gap-3 sm:ml-auto sm:max-w-[560px] sm:grid-cols-2">
              <button
                onClick={() => submitAssessment(false)}
                disabled={loading}
                className="btn-text btn btn-success fw-bold min-h-[52px] rounded-[10px] px-6 py-3 font-extrabold text-white disabled:opacity-70"
              >
                {actionLoading === 'draft' ? 'Saving draft...' : 'Save draft'}
              </button>
              <button
                onClick={() => submitAssessment(true)}
                disabled={loading}
                className="btn-text btn btn-warning fw-bold min-h-[52px] rounded-[10px] px-7 py-3 font-extrabold text-[#071b49] disabled:opacity-70"
              >
                {actionLoading === 'prediction' ? 'Generating...' : 'Generate prediction'}
              </button>
            </div>
          </section>

          <PredictionResultPanel
            bmi={bmi}
            error={error}
            form={form}
            loading={actionLoading === 'prediction' && loading}
            prediction={predictionResult}
            syncing={syncingPrediction}
          />
        </>
      )}

      {statusMessage && (
        <div className="alert alert-info rounded-4 fw-bold rounded-[14px] border border-[#c7d8eb] bg-white px-4 py-3 text-[14px] text-[#20365f] shadow-sm">
          {statusMessage}
        </div>
      )}

      {mode === 'dataset' && datasetPredictionReport && (
        <DatasetPredictionReport report={datasetPredictionReport} />
      )}
    </div>
  )
}

function FormSection({ bmi, form, section, updateField }) {
  const gridClass = section.columns === 3 ? 'lg:grid-cols-2 2xl:grid-cols-3' : 'lg:grid-cols-2'

  return (
    <section className="card border-0 shadow-sm rounded-4 mb-3 min-w-0 rounded-[16px] border border-[#cfdded] bg-[#f8fbff] px-5 py-5 md:px-6">
      <div className={`card-body p-0 grid min-w-0 gap-4 ${gridClass}`}>
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
  const isRequired = requiredPredictionFieldMap.has(item.key)

  if (item.type === 'readonly') {
    return <ReadOnlyField label={item.label} source={item.source} suffix={item.suffix} value={value || 'Enter height and weight'} />
  }

  if (item.type === 'select') {
    return (
      <FieldShell coding={item.coding} isRequired={isRequired} label={item.label} source={item.source}>
        <select
          aria-required={isRequired}
          className="form-select min-h-[50px] w-full rounded-[10px] border border-[#c7d8eb] bg-white px-4 text-[15px] font-semibold text-[#071b49] outline-none focus:border-[#1768f2]"
          required={isRequired}
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
      <FieldShell coding={item.coding} isRequired={isRequired} label={item.label} source={item.source}>
        <textarea
          aria-required={isRequired}
          className="form-control min-h-[94px] w-full resize-y rounded-[10px] border border-[#c7d8eb] bg-white px-4 py-3 text-[15px] font-semibold text-[#071b49] outline-none focus:border-[#1768f2]"
          required={isRequired}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </FieldShell>
    )
  }

  return (
    <FieldShell coding={item.coding} isRequired={isRequired} label={item.label} source={item.source}>
      <div className="input-group flex min-h-[50px] items-center rounded-[10px] border border-[#c7d8eb] bg-white px-4 focus-within:border-[#1768f2]">
        <input
          aria-required={isRequired}
          className="form-control border-0 shadow-none min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#071b49] outline-none"
          required={isRequired}
          type={item.type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {item.suffix && <span className="ml-2 shrink-0 text-[13px] font-bold text-[#6c7f9f]">{item.suffix}</span>}
      </div>
    </FieldShell>
  )
}

function FieldShell({ children, coding, isRequired = false, label, source }) {
  return (
    <label className="min-w-0">
      <span className="form-label mb-2 flex items-center gap-2 text-[14px] font-bold text-[#49617f]">
        <span>{label}</span>
        {isRequired && (
          <span aria-label="required" className="text-[18px] font-black leading-none text-[#dc2626]">*</span>
        )}
      </span>
      {children}
    </label>
  )
}

function ReadOnlyField({ label, source, suffix, value }) {
  return (
    <div className="min-w-0">
      <span className="form-label mb-2 block text-[14px] font-bold text-[#49617f]">{label}</span>
      <div className="form-control bg-light flex min-h-[50px] items-center rounded-[10px] border border-[#c7d8eb] px-4 text-[15px] font-black text-[#071b49]">
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
      className={`btn-text btn rounded-[10px] px-5 py-3 font-extrabold transition ${
        active ? 'btn-light active bg-white text-[#071b49] shadow-sm' : 'btn-outline-secondary border-0 text-[#53668a] hover:text-[#071b49]'
      }`}
    >
      {children}
    </button>
  )
}

function PredictionResultPanel({ bmi, error, form, loading, prediction, syncing }) {
  if (loading) {
    return (
      <section className="card border-0 shadow-sm rounded-4 mb-3 rounded-[16px] border border-[#d7e4f4] bg-white px-5 py-5 md:px-6" aria-live="polite">
        <div className="flex items-center gap-4">
          <span className="h-10 w-10 shrink-0 animate-spin rounded-full border-4 border-[#dbeafe] border-t-[#1768f2]" />
          <div>
            <h2 className="card-title font-black text-[#071b49]">Generating prediction</h2>
            <p className="small-text mt-1 font-semibold text-[#53668a]">
              Sending the completed clinical form to the prediction service. Please wait.
            </p>
          </div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="alert alert-danger rounded-4 rounded-[16px] border border-[#fecaca] bg-[#fff5f5] px-5 py-5 md:px-6" role="alert">
        <h2 className="card-title font-black text-[#991b1b]">Prediction could not be generated</h2>
        <p className="small-text mt-2 font-semibold text-[#7f1d1d]">{error}</p>
      </section>
    )
  }

  if (!prediction) return null

  const probability = normalizeProbability(prediction.predicted_probability ?? prediction.probability)
  const riskLevel = classifyRisk(probability)
  const veryCritical = isVeryCriticalSurgeryPatient(form, riskLevel)
  const recommendation = clinicalRecommendation(riskLevel, veryCritical)
  const keyPredictors = getKeyPredictors(prediction, form, bmi)
  const tone = riskTone(riskLevel)

  return (
    <section className={`card border-0 shadow-lg rounded-4 mb-3 rounded-[16px] border-2 ${tone.border} ${tone.bg} px-5 py-5 md:px-6`} aria-live="polite">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <p className={`risk-badge-text badge rounded-pill px-4 py-2 font-black uppercase tracking-[0.14em] shadow-sm ${tone.badge}`}>
            Prediction Result
          </p>
          {syncing && (
            <p className="mt-2 text-[13px] font-bold text-[#53668a]" aria-live="polite">
              Updating from backend...
            </p>
          )}
          <h2 className="section-title mt-3 font-black text-[#06163d]">Postoperative oxygen requirement assessment</h2>
          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,1fr)]">
            <OutcomeMetric label="Probability of Postoperative Oxygen Requirement" value={`${probability}%`} valueClass={tone.text} />
            <KeyPredictors predictors={keyPredictors} />
          </div>
          <div className={`mt-4 rounded-[12px] border-2 ${tone.border} bg-white px-4 py-4 shadow-sm`}>
            <p className="text-[13px] font-black uppercase tracking-[0.12em] text-[#071b49]">Recommendation</p>
            <p className="mt-2 text-[16px] font-bold leading-7 text-[#20365f]">{recommendation}</p>
          </div>
        </div>

        <div className={`w-full rounded-[14px] border-2 ${tone.border} bg-white px-5 py-5 shadow-md xl:max-w-[320px]`}>
          <p className="text-center text-[13px] font-black uppercase tracking-[0.14em] text-[#071b49]">Current prediction</p>
          <div className={`mx-auto mt-3 flex h-36 w-36 items-center justify-center rounded-full border-[12px] ${tone.ring}`}>
            <span className={`prediction-value font-black ${tone.text}`}>{probability}%</span>
          </div>
          <p className={`risk-badge-text mx-auto mt-4 w-fit rounded-full px-4 py-2 text-center font-black uppercase ${tone.badge}`}>{riskLevel}</p>
          <p className="mt-3 text-center text-[14px] font-bold leading-6 text-[#20365f]">
            Classification uses Low &lt;30%, Moderate 30-69%, High 70% and above.
          </p>
        </div>
      </div>
    </section>
  )
}

function KeyPredictors({ predictors }) {
  return (
    <div className="rounded-[12px] border-2 border-[#1768f2] bg-white px-4 py-3 shadow-sm">
      <p className="text-[13px] font-black uppercase tracking-[0.12em] text-[#071b49]">Key Predictors</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {predictors.map((predictor, index) => (
          <span
            key={`${predictor}-${index}`}
            className="rounded-full border border-[#1768f2] bg-[#eaf2ff] px-3 py-1 text-[13px] font-black text-[#071b49]"
          >
            {index + 1}. {predictor}
          </span>
        ))}
      </div>
    </div>
  )
}

function OutcomeMetric({ label, value, valueClass = 'text-[#071b49]' }) {
  return (
    <div className="card border-0 shadow-sm rounded-4 rounded-[12px] border-2 border-[#1768f2] bg-white px-4 py-3">
      <p className="card-text text-[13px] font-black uppercase tracking-[0.08em] text-[#071b49]">{label}</p>
      <p className={`mt-2 text-[28px] font-black ${valueClass}`}>{value}</p>
    </div>
  )
}

function getKeyPredictors(prediction, form, bmi) {
  const backendPredictors = normalizePredictorList(prediction?.contributing_factors || prediction?.factors)
  if (backendPredictors.length > 0) return backendPredictors.slice(0, 5)

  const baselineSpo2 = Number(form?.baselineSpo2)
  const duration = Number(form?.durationOfSurgery)
  const bmiValue = Number(bmi)
  const age = Number(form?.age || form?.screeningAge)

  const predictors = [
    {
      present: Number.isFinite(baselineSpo2) && baselineSpo2 <= 94,
      label: `Baseline SpO2 ${baselineSpo2}%`,
    },
    {
      present: ['III', 'IV', 'V'].includes(String(form?.asaClass || '').toUpperCase()),
      label: `ASA ${form?.asaClass}`,
    },
    {
      present: String(form?.surgeryStatus || '').toLowerCase() === 'emergency',
      label: 'Emergency surgery',
    },
    {
      present: Number.isFinite(duration) && duration >= 180,
      label: `Expected duration ${duration} min`,
    },
    {
      present: Number.isFinite(bmiValue) && bmiValue >= 30,
      label: `BMI ${bmiValue.toFixed(1)}`,
    },
    {
      present: form?.typeOfAnesthesia === 'General',
      label: 'Expected general anesthesia',
    },
    {
      present: form?.surgicalApproach === 'Open',
      label: 'Expected open surgical approach',
    },
    {
      present: Number.isFinite(age) && age >= 65,
      label: `Age ${age} years`,
    },
  ]
    .filter((item) => item.present)
    .map((item) => item.label)

  return predictors.length > 0 ? predictors.slice(0, 5) : ['Clinical form variables', 'Surgery profile', 'Anesthesia profile']
}

function normalizePredictorList(items) {
  if (!Array.isArray(items)) return []

  return items
    .map((item) => {
      if (!item) return ''
      if (typeof item === 'string') return item
      return item.display || item.label || item.feature || ''
    })
    .map((item) => String(item).trim())
    .filter(Boolean)
}

function DatasetPanel({
  datasetColumns,
  datasetName,
  loading,
  onDatasetFileChange,
  onUploadAndPredict,
  setTargetColumn,
  targetColumn,
}) {
  return (
    <section className="card border-0 shadow-sm rounded-4 mb-3 rounded-[16px] border border-[#cfdded] bg-white px-5 py-5 md:px-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="section-title font-black text-[#071b49]">Upload dataset for prediction</h2>
          <p className="body-text mt-2 max-w-[650px] text-[#53668a]">
            Upload a patient dataset, choose the target column from its columns, and run prediction with the active trained model.
          </p>
        </div>
        <span className="rounded-[10px] bg-[#eaf2ff] px-4 py-2 text-[13px] font-extrabold text-[#1768f2]">
          CSV, TSV, JSON, Excel
        </span>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <label className="card flex min-h-[210px] cursor-pointer flex-col items-center justify-center rounded-4 border-2 border-dashed border-[#b8cbe4] bg-[#f8fbff] px-6 text-center transition hover:border-[#1768f2] hover:bg-[#f3f8ff]">
          <input
            type="file"
            accept=".csv,.tsv,.txt,.json,.xlsx,.xls"
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

        <div className="card rounded-4 border border-[#cfdded] bg-[#f8fbff] p-5">
          <ReadOnlyDatasetField label="Dataset name" value={datasetName || 'No dataset selected'} />
          <SimpleSelect
            label="Target column"
            value={targetColumn}
            onChange={setTargetColumn}
            options={datasetColumns}
            placeholder={datasetColumns.length > 0 ? 'Select target column' : 'Upload readable dataset first'}
          />
          <button
            onClick={onUploadAndPredict}
            disabled={loading || !datasetName}
            className="btn-text btn btn-dark fw-bold w-full rounded-[10px] px-7 py-3 font-extrabold text-white disabled:opacity-70"
          >
            {loading ? 'Uploading...' : 'Upload and predict'}
          </button>
        </div>
      </div>
    </section>
  )
}

function DatasetPredictionReport({ report }) {
  const probability = report.probability === undefined || report.probability === null
    ? 'Not generated'
    : `${normalizeProbability(report.probability)}%`

  return (
    <section className="card border-0 shadow-sm rounded-4 mb-3 rounded-[16px] border border-[#c7d8eb] bg-white px-5 py-5 md:px-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="small-text text-primary fw-bold text-uppercase mb-2 font-extrabold tracking-[0.14em]">Dataset prediction report</p>
          <h2 className="section-title font-black text-[#071b49]">Prediction summary</h2>
        </div>
        <span className="rounded-[10px] bg-[#dcfce7] px-4 py-2 text-[13px] font-extrabold text-[#166534]">
          {report.predictionStatus}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ReportMetric label="Dataset" value={report.datasetName || 'Not selected'} />
        <ReportMetric label="Target column" value={report.targetColumn || 'Not selected'} />
        <ReportMetric label="Active trained model" value={report.activeModel || 'No active model'} />
        <ReportMetric label="Model type" value={report.modelType || 'Not available'} />
        <ReportMetric label="Training accuracy" value={formatTrainingMetric(report.trainingMetrics?.val_accuracy)} />
        <ReportMetric label="Training F1-score" value={formatTrainingMetric(report.trainingMetrics?.val_f1_score ?? report.trainingMetrics?.f1_score)} />
        <ReportMetric label="Rows in dataset" value={report.rowCount ?? 'Not available'} />
        <ReportMetric label="Predicted rows" value={report.predictedRows ?? 'Not available'} />
        <ReportMetric label="High risk rows" value={report.highRiskRows ?? 0} />
        <ReportMetric label="Moderate risk rows" value={report.moderateRiskRows ?? 0} />
        <ReportMetric label="Low risk rows" value={report.lowRiskRows ?? 0} />
        <ReportMetric label="First row probability" value={probability} />
        <ReportMetric label="First row risk level" value={report.riskLevel || 'Not generated'} />
      </div>
    </section>
  )
}

function ReportMetric({ label, value }) {
  return (
    <div className="rounded-[12px] border border-[#d7e4f4] bg-[#f8fbff] px-4 py-3">
      <p className="text-[12px] font-black uppercase tracking-[0.1em] text-[#53668a]">{label}</p>
      <p className="mt-2 break-words text-[15px] font-black text-[#071b49]">{value}</p>
    </div>
  )
}

function ReadOnlyDatasetField({ label, value }) {
  return (
    <div className="block">
      <span className="form-label mb-2 block text-[14px] font-bold text-[#49617f]">{label}</span>
      <div className="form-control flex min-h-[50px] items-center rounded-[10px] border border-[#c7d8eb] bg-white px-4 text-[15px] font-semibold text-[#071b49]">
        {value}
      </div>
    </div>
  )
}

function SimpleSelect({ label, options, onChange, placeholder, value }) {
  return (
    <label className="block">
      <span className="form-label mb-2 block text-[14px] font-bold text-[#49617f]">{label}</span>
      <select
        className="form-select min-h-[50px] w-full rounded-[10px] border border-[#c7d8eb] bg-white px-4 text-[15px] font-semibold text-[#071b49] outline-none focus:border-[#1768f2]"
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

function defaultTargetColumn(columns) {
  if (!columns.length) return ''
  const preferredTargets = [
    'postoperative_oxygen_required',
    'oxygen_required',
    'oxygen_requirement',
    'requires_oxygen',
    'target',
    'label',
    'outcome',
  ]
  const normalizedColumns = columns.map((column) => String(column).toLowerCase())
  const preferredIndex = normalizedColumns.findIndex((column) => preferredTargets.includes(column))
  return preferredIndex >= 0 ? columns[preferredIndex] : columns[columns.length - 1]
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

  const airwayEvent = form.intraoperativeBronchospasm === 'Yes'
    ? 'Bronchospasm'
    : form.intraoperativeDesaturation === 'Yes'
      ? 'Desaturation'
      : form.airwayType === 'Endotracheal tube'
        ? 'Difficult Intubation'
        : 'None'
  const baselineSpo2 = Number(form.baselineSpo2) || 0
  const intraoperativeSpo2 = Number(form.intraoperativeSpo2) || 0
  const estimatedPostopSpo2 = intraoperativeSpo2 || (form.intraoperativeDesaturation === 'Yes' ? Math.max(88, baselineSpo2 - 4) : baselineSpo2)

  return {
    patient_coded_id: form.patientCodedId,
    ward_or_service: form.wardService,
    date_of_admission: form.admissionDate,
    date_of_surgery: form.surgeryDate,
    age: Number(form.age || form.screeningAge) || 0,
    age_years: Number(form.age || form.screeningAge) || 0,
    pediatric_case: Number(form.age || form.screeningAge) < 18 ? 'Yes' : 'No',
    sex: form.sex,
    eligible_for_study: form.eligibleForStudy,
    reason_for_exclusion: form.exclusionReason || 'None',
    data_sources_reviewed: form.dataSourcesReviewed,
    weight_kg: Number(form.weight) || 0,
    height_cm: Number(form.height) || 0,
    bmi: Number(bmi) || 0,
    body_mass_index: Number(bmi) || 0,
    smoking_history: form.smokingHistory === 'Yes',
    alcohol_use: form.alcoholUse,
    comorbidities,
    baseline_spo2: baselineSpo2,
    baseline_room_air_spo2_percent: baselineSpo2,
    baseline_respiratory_rate_bpm: Number(form.baselineRespiratoryRate) || 0,
    baseline_heart_rate_bpm: Number(form.baselineHeartRate) || 0,
    baseline_systolic_bp_mmhg: Number(form.baselineSystolicBp) || 0,
    baseline_diastolic_bp_mmhg: Number(form.baselineDiastolicBp) || 0,
    preoperative_hemoglobin_gdl: Number(form.preoperativeHemoglobin) || 0,
    other_relevant_preoperative_labs: form.otherPreoperativeLabs || 'None',
    pre_existing_respiratory_disease: form.preExistingRespiratoryDisease,
    copd_or_asthma: form.copdAsthma,
    cardiovascular_disease: form.cardiovascularDisease,
    hypertension: form.hypertension,
    diabetes_mellitus: form.diabetesMellitus,
    renal_disease: form.renalDisease,
    hiv_status: form.hivStatus,
    anemia: form.anemia,
    obesity: form.obesity,
    sleep_apnea: form.sleepApnea,
    surgical_specialty: form.surgicalSpecialty,
    type_of_surgery_performed: form.typeOfSurgery || form.surgicalSpecialty,
    surgery_type: mapSurgeryType(form.typeOfSurgery || form.surgicalSpecialty),
    urgency: String(form.surgeryStatus || '').toLowerCase(),
    surgery_status: form.surgeryStatus,
    major_or_minor_surgery: form.surgeryMagnitude,
    surgical_approach: form.surgicalApproach,
    expected_airway_type: form.airwayType,
    expected_intraoperative_opioid_use: form.intraoperativeOpioidUse,
    expected_sedative_use: form.sedativeUse,
    expected_muscle_relaxant_use: form.muscleRelaxantUsed,
    expected_reversal_agent_use: form.reversalAgentUsed,
    expected_intraoperative_hypotension_risk: form.intraoperativeHypotension,
    expected_intraoperative_bronchospasm_risk: form.intraoperativeBronchospasm,
    expected_intraoperative_desaturation_risk: form.intraoperativeDesaturation,
    expected_intraoperative_fluid_volume_ml: Number(form.intraoperativeFluidVolume) || 0,
    expected_vasopressor_use: form.vasopressorUsed,
    surgery_duration: Number(form.durationOfSurgery) || 0,
    duration_of_surgery_minutes: Number(form.durationOfSurgery) || 0,
    blood_loss: mapBloodLoss(form.estimatedBloodLoss),
    estimated_blood_loss_ml: Number(form.estimatedBloodLoss) || 0,
    ward: mapWard(form.wardService),
    anesthesia_type: mapAnesthesiaType(form.typeOfAnesthesia),
    postoperative_destination: mapWard(form.wardService),
    asa_class: form.asaClass,
    residual_effects: form.reversalAgentUsed === 'No' && form.muscleRelaxantUsed === 'Yes',
    opioid_use: form.intraoperativeOpioidUse === 'Yes',
    airway_event: airwayEvent,
    recovery_status: form.intraoperativeHypotension === 'Yes' || form.vasopressorUsed === 'Yes' ? 'Monitored' : 'Stable',
    postop_spo2: estimatedPostopSpo2,
    respiratory_rate: Number(form.baselineRespiratoryRate) || 0,
    pain_status: form.totalOpioidDose ? 'Moderate' : 'Mild',
    consciousness: form.sedativeUse === 'Yes' ? 'Drowsy' : 'Alert',
    time_since_surgery: 0,
    oxygen_before_prediction: form.intraoperativeDesaturation === 'Yes',
    full_case_report_form: form,
  }
}

function mapSurgeryType(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized.includes('ortho')) return 'Orthopedic'
  if (normalized.includes('obst')) return 'Obstetric'
  if (normalized.includes('gyne')) return 'Gynecologic'
  if (normalized.includes('ent')) return 'ENT'
  return 'Abdominal'
}

function mapBloodLoss(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Minimal'
  if (numeric >= 1000) return 'Severe'
  if (numeric >= 300) return 'Moderate'
  return 'Minimal'
}

function mapWard(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized.includes('icu')) return 'ICU'
  if (normalized.includes('pacu') || normalized.includes('recovery')) return 'PACU'
  return 'Surgical Ward'
}

function mapAnesthesiaType(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized.includes('spinal')) return 'Spinal'
  if (normalized.includes('regional')) return 'Regional'
  if (normalized.includes('sedation')) return 'Sedation'
  return 'General'
}

function validatePredictionFields(form, bmi) {
  const missing = requiredPredictionFields
    .filter(([key]) => !String(form[key] ?? '').trim())
    .map(([key, label]) => requiredPredictionFieldMap.get(key) || label)

  if (!bmi) missing.push('Body mass index')
  return missing
}

function normalizeProbability(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return 0
  const percentValue = numericValue <= 1 ? numericValue * 100 : numericValue
  return Math.min(100, Math.max(0, Math.round(percentValue)))
}

function formatTrainingMetric(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return 'Not available'
  const percentValue = numericValue <= 1 ? numericValue * 100 : numericValue
  return `${Math.round(percentValue * 10) / 10}%`
}

function classifyRisk(probability) {
  if (probability < 30) return 'Low Risk'
  if (probability < 70) return 'Moderate Risk'
  return 'High Risk'
}

function clinicalRecommendation(riskLevel, veryCritical = false) {
  const criticalSupport = 'Because this is a very critical surgical patient, book an ICU or HDU bed when available to support cardiorespiratory monitoring and escalation after surgery.'

  if (riskLevel === 'High Risk') {
    return `Patient has a high predicted risk of requiring postoperative oxygen. Book an ICU or HDU bed for closer monitoring and cardiorespiratory support, provide close postoperative monitoring, prepare oxygen support, monitor SpO2 continuously, and arrange early senior clinician review.`
  }

  if (riskLevel === 'Moderate Risk') {
    const base = 'Patient has a moderate predicted risk of requiring postoperative oxygen. Monitor SpO2 closely, ensure oxygen equipment is available, and reassess respiratory status frequently during the early postoperative period.'
    return veryCritical ? `${base} ${criticalSupport}` : base
  }

  const base = 'Patient has a low predicted risk of requiring postoperative oxygen. Continue routine postoperative monitoring, maintain standard recovery room observation, and reassess if clinical condition changes.'
  return veryCritical ? `${base} ${criticalSupport}` : base
}

function isVeryCriticalSurgeryPatient(form, riskLevel) {
  const asaClass = String(form?.asaClass || '').toUpperCase()
  const emergency = String(form?.surgeryStatus || '').toLowerCase() === 'emergency'
  const majorSurgery = String(form?.surgeryMagnitude || '').toLowerCase() === 'major'
  const anesthesia = String(form?.typeOfAnesthesia || '').toLowerCase()
  const hasSevereAsa = ['IV', 'V'].includes(asaClass)
  const hasHighAcuityAsa = ['III', 'IV', 'V'].includes(asaClass)
  const highRisk = riskLevel === 'High Risk'

  return hasSevereAsa || highRisk || (emergency && hasHighAcuityAsa) || (emergency && majorSurgery && anesthesia.includes('general'))
}

function riskTone(riskLevel) {
  if (riskLevel === 'High Risk') {
    return {
      bg: 'bg-[#fff1f2]',
      border: 'border-[#dc2626]',
      badge: 'bg-[#dc2626] text-white',
      ring: 'border-[#dc2626] bg-[#fff5f5]',
      text: 'text-[#b91c1c]',
    }
  }

  if (riskLevel === 'Moderate Risk') {
    return {
      bg: 'bg-[#fffbeb]',
      border: 'border-[#d97706]',
      badge: 'bg-[#d97706] text-white',
      ring: 'border-[#d97706] bg-[#fff7ed]',
      text: 'text-[#b45309]',
    }
  }

  return {
    bg: 'bg-[#f0fdf4]',
    border: 'border-[#16a34a]',
    badge: 'bg-[#16a34a] text-white',
    ring: 'border-[#16a34a] bg-[#f0fdf4]',
    text: 'text-[#15803d]',
  }
}

function field(key, label, type, options, source, suffix, coding) {
  return { key, label, type, options, source, suffix, coding }
}

function capitalize(value) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}
