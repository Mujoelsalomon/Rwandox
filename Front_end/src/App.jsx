import React, { useEffect, useRef } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { canAccessTraining, clearCurrentSession, getSession, isAdminSession, isSessionActive } from './authSession.js'
import AppLayout from './components/AppLayout.jsx'
import NewPredictionContent from './components/NewPredictionContent.jsx'
import ProfileContent from './components/ProfileContent.jsx'
import PredictionHistoryContent from './components/PredictionHistoryContent.jsx'
import SettingsContent from './components/SettingsContent.jsx'
import SupportPortal from './components/SupportPortal.jsx'
import SystemAdministrationContent from './components/SystemAdministrationContent.jsx'
import Login_Form from './components/Login_Form.jsx'
import Sign_Up_Form from './components/Sign_Up_Form.jsx'
import PostoperativeOxygenMLUIMockup from './PostoperativeOxygenMLUIMockup.jsx'
import TrainingPortal from './TrainingPortal.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <IdleSessionTimeout />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login_Form />} />
        <Route path="/signup" element={<Sign_Up_Form />} />
        <Route
          path="/dashboard"
          element={(
            <ProtectedRoute>
              <PostoperativeOxygenMLUIMockup />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/new-prediction"
          element={(
            <ProtectedRoute>
              <AppLayout>
                <NewPredictionContent />
              </AppLayout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/profile"
          element={(
            <ProtectedRoute>
              <AppLayout>
                <ProfileContent />
              </AppLayout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/prediction-history"
          element={(
            <ProtectedRoute>
              <AppLayout>
                <PredictionHistoryContent />
              </AppLayout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/settings"
          element={(
            <ProtectedRoute>
              <AppLayout>
                <SettingsContent />
              </AppLayout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/support"
          element={(
            <ProtectedRoute>
              <AppLayout>
                <SupportPortal />
              </AppLayout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/system-administration"
          element={(
            <ProtectedRoute adminOnly>
              <AppLayout>
                <SystemAdministrationContent />
              </AppLayout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/train"
          element={(
            <ProtectedRoute trainingOnly>
              <AppLayout>
                <TrainingPortal />
              </AppLayout>
            </ProtectedRoute>
          )}
        />
      </Routes>
    </BrowserRouter>
  )
}

const IDLE_TIMEOUT_MS = 10 * 60 * 1000

function IdleSessionTimeout() {
  const navigate = useNavigate()
  const timeoutRef = useRef(null)

  useEffect(() => {
    const activityEvents = ['click', 'keydown', 'pointerdown', 'touchstart', 'scroll']

    function clearIdleTimer() {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    function logoutInactiveUser() {
      if (!isSessionActive()) return
      clearCurrentSession()
      navigate('/login', { replace: true })
    }

    function resetIdleTimer() {
      clearIdleTimer()
      if (!isSessionActive()) return
      timeoutRef.current = window.setTimeout(logoutInactiveUser, IDLE_TIMEOUT_MS)
    }

    resetIdleTimer()
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetIdleTimer, { passive: true, capture: true })
    })

    return () => {
      clearIdleTimer()
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetIdleTimer, { capture: true })
      })
    }
  }, [navigate])

  return null
}

function ProtectedRoute({ adminOnly = false, trainingOnly = false, children }) {
  const session = getSession()
  if (!isSessionActive(session)) {
    return <Navigate to="/login" replace />
  }
  if (adminOnly && !isAdminSession(session)) {
    return <Navigate to="/dashboard" replace />
  }
  if (trainingOnly && !canAccessTraining(session)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
