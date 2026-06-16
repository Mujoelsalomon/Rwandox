import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSessionActive, SESSION_EVENT, SESSION_KEY, SESSION_REVOKED_AT_KEY } from './authSession.js'
import DashboardContent from './components/DashboardContent.jsx'
import Footer from './components/Footer.jsx'
import SidebarMenu from './components/SidebarMenu.jsx'
import TopMenu from './components/TopMenu.jsx'
import { useResizableSidebar } from './components/useResizableSidebar.js'
import { API_BASE_URL } from './config/api.js'
import { MODEL_REGISTRY_UPDATED_EVENT, notifyPredictionHistoryUpdated } from './predictionEvents.js'

function normalizePredictionResponse(res) {
  const rawProbability = res?.predicted_probability ?? res?.probability
  const hasProbability = rawProbability !== undefined && rawProbability !== null && rawProbability !== ''
  const probability = Number(rawProbability ?? 0)
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
    riskLabel: riskLevel || (hasProbability ? (probability >= 0.5 ? 'High' : 'Low') : ''),
    usedTrainedModel: Boolean(res?.used_trained_model),
    activeModel: res?.active_model && typeof res.active_model === 'object' ? res.active_model : null,
  }
}

export default function PostoperativeOxygenMLUIMockup() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 1024
  })
  const {
    maxSidebarWidth,
    minSidebarWidth,
    onSidebarResizeKeyDown,
    onSidebarResizeStart,
    sidebarWidth,
    sidebarWidthStyle,
  } = useResizableSidebar(setSidebarOpen)
  const [probability, setProbability] = useState(0)
  const [riskLabel, setRiskLabel] = useState('')
  const [factorChips, setFactorChips] = useState([])
  const [recommendations, setRecommendations] = useState([])
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

  const fetchActiveModel = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/models`, { credentials: 'include' })
      if (!resp.ok) return
      const data = await resp.json()
      const active = Array.isArray(data.models) ? data.models.find((model) => model.is_active) : null
      setActiveModel(active || null)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    fetchActiveModel()

    function handleModelRegistryUpdated() {
      fetchActiveModel()
    }

    window.addEventListener(MODEL_REGISTRY_UPDATED_EVENT, handleModelRegistryUpdated)
    return () => window.removeEventListener(MODEL_REGISTRY_UPDATED_EVENT, handleModelRegistryUpdated)
  }, [fetchActiveModel])

  useEffect(() => {
    function handleResize() {
      setSidebarOpen(window.innerWidth >= 1024)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function requestPrediction() {
    try {
      const resp = await fetch(`${API_BASE_URL}/predict`, {
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
        const data = await resp.json()
        notifyPredictionHistoryUpdated(data)
        return normalizePredictionResponse(data)
      }
    } catch (e) {
      console.error(e)
    }

    return {
      probability: 0,
      factors: [],
      recommendations: [],
      riskLabel: '',
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
      if (res.activeModel) {
        setActiveModel(res.activeModel)
      } else {
        fetchActiveModel()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-fluid flex h-screen flex-col overflow-hidden bg-[#f6f9fd] pb-[72px] pt-[88px] text-slate-900 px-0">
      <TopMenu
        isSidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <SidebarMenu isOpen={sidebarOpen} onNavigate={() => {
          if (window.innerWidth < 1024) {
            setSidebarOpen(false)
          }
        }} widthStyle={sidebarWidthStyle} />
        <div
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          aria-valuemax={maxSidebarWidth}
          aria-valuemin={minSidebarWidth}
          aria-valuenow={sidebarWidth}
          className="sidebar-resize-handle hidden lg:block"
          onKeyDown={onSidebarResizeKeyDown}
          onPointerDown={onSidebarResizeStart}
          role="separator"
          tabIndex={0}
          title="Drag to resize sidebar"
        />

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8 pt-4 md:px-5">
          <div className="container-fluid mx-auto min-w-0 max-w-[1540px] px-0">
            <DashboardContent
              activeModel={activeModel}
              factorChips={factorChips}
              handleGenerate={handleGenerate}
              loading={loading}
              onRefreshModel={fetchActiveModel}
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
