import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSessionActive, SESSION_EVENT, SESSION_KEY, SESSION_REVOKED_AT_KEY } from './authSession.js'
import DashboardContent from './components/DashboardContent.jsx'
import Footer from './components/Footer.jsx'
import SidebarMenu from './components/SidebarMenu.jsx'
import TopMenu from './components/TopMenu.jsx'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function normalizePredictionResponse(res) {
  const probability = Number(res?.predicted_probability ?? res?.probability ?? 0)
  const riskLevel = String(res?.risk_level ?? '')
  const factors = Array.isArray(res?.contributing_factors)
    ? res.contributing_factors.map((item) => item.display || item.feature || String(item))
    : Array.isArray(res?.factors)
      ? res.factors.map((item) => item.display || item.feature || String(item))
      : []
  const recommendations = Array.isArray(res?.recommendations) ? res.recommendations : []

  return {
    probability,
    factors,
    recommendations,
    riskLabel: riskLevel || (probability >= 0.5 ? 'High' : 'Low'),
    usedTrainedModel: Boolean(res?.used_trained_model),
    activeModel: res?.active_model || null,
  }
}

export default function PostoperativeOxygenMLUIMockup() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 1024
  })
  const [probability, setProbability] = useState(0.82)
  const [riskLabel, setRiskLabel] = useState('High')
  const [factorChips, setFactorChips] = useState([
    'Post-op SpO2 90%',
    'ASA III',
    'Emergency surgery',
    'Duration 210 min',
    'BMI 31.2',
  ])
  const [recommendations, setRecommendations] = useState([
    'Start close oxygen monitoring immediately.',
    'Prepare supplemental oxygen in PACU or ward.',
    'Repeat SpO2 and respiratory rate within 15 minutes.',
    'Escalate clinical review if saturation remains below target.',
  ])
  const [loading, setLoading] = useState(false)
  const [activeModel, setActiveModel] = useState(null)

  useEffect(() => {
    function enforceActiveSession() {
      if (!isSessionActive()) {
        navigate('/login', { replace: true })
      }
    }

    function handleStorage(event) {
      if (event.key === SESSION_KEY || event.key === SESSION_REVOKED_AT_KEY) {
        enforceActiveSession()
      }
    }

    enforceActiveSession()
    window.addEventListener(SESSION_EVENT, enforceActiveSession)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(SESSION_EVENT, enforceActiveSession)
      window.removeEventListener('storage', handleStorage)
    }
  }, [navigate])

  useEffect(() => {
    fetchActiveModel()
  }, [])

  useEffect(() => {
    function handleResize() {
      setSidebarOpen(window.innerWidth >= 1024)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function fetchActiveModel() {
    try {
      const resp = await fetch(`${API_URL}/models`, { credentials: 'include' })
      if (!resp.ok) return
      const data = await resp.json()
      const active = Array.isArray(data.models) ? data.models.find((model) => model.is_active) : null
      setActiveModel(active || null)
    } catch (e) {
      console.error(e)
    }
  }

  async function requestPrediction() {
    try {
      const resp = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          features: {
            age: 62,
            sex: 'Female',
            bmi: 31.2,
            smoking_history: false,
            comorbidities: 'Hypertension, asthma',
            baseline_spo2: 95,
            surgery_type: 'Abdominal surgery',
            urgency: 'emergency',
            surgery_duration: 210,
            blood_loss: 'Moderate',
            ward: 'PACU',
            anesthesia_type: 'General',
            asa_class: 'III',
            residual_effects: true,
            opioid_use: true,
            airway_event: 'None',
            recovery_status: 'Monitored',
            postop_spo2: 90,
            respiratory_rate: 26,
            pain_status: 'Severe',
            consciousness: 'Drowsy',
            time_since_surgery: 30,
            oxygen_before_prediction: false,
          },
        }),
      })
      if (resp.ok) {
        return normalizePredictionResponse(await resp.json())
      }
    } catch (e) {
      console.error(e)
    }

    return {
      probability: 0.82,
      factors: ['Post-op SpO2 90%', 'ASA III', 'Emergency surgery', 'Duration 210 min', 'BMI 31.2'],
      recommendations: [
        'Start close oxygen monitoring immediately.',
        'Prepare supplemental oxygen in PACU or ward.',
        'Repeat SpO2 and respiratory rate within 15 minutes.',
        'Escalate clinical review if saturation remains below target.',
      ],
      riskLabel: 'High',
      usedTrainedModel: false,
      activeModel: null,
    }
  }

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await requestPrediction()
      setProbability(res.probability)
      setFactorChips(res.factors)
      setRecommendations(res.recommendations)
      setRiskLabel(res.riskLabel)
      setActiveModel(res.activeModel)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f6f9fd] pb-[57px] pt-[73px] text-slate-900">
      <TopMenu
        isSidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
      />
      <div className="flex h-[calc(100vh-130px)] min-h-0 flex-col overflow-hidden lg:flex-row">
        <SidebarMenu isOpen={sidebarOpen} onNavigate={() => {
          if (window.innerWidth < 1024) {
            setSidebarOpen(false)
          }
        }} />

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 md:px-5">
          <div className="mx-auto min-w-0 max-w-[1540px]">
            <DashboardContent
              activeModel={activeModel}
              factorChips={factorChips}
              handleGenerate={handleGenerate}
              loading={loading}
              probability={probability}
              recommendations={recommendations}
              riskLabel={riskLabel}
            />
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
