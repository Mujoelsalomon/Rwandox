import React, { Suspense, lazy, useEffect, useRef } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { canAccessTraining, clearCurrentSession, getSession, isAdminSession, isSessionActive } from './authSession.js'
import AppLayout from './components/AppLayout.jsx'
import Login_Form from './components/Login_Form.jsx'

const NewPredictionContent = lazy(() => import('./components/NewPredictionContent.jsx'))
const ProfileContent = lazy(() => import('./components/ProfileContent.jsx'))
const PredictionHistoryContent = lazy(() => import('./components/PredictionHistoryContent.jsx'))
const SettingsContent = lazy(() => import('./components/SettingsContent.jsx'))
const SupportPortal = lazy(() => import('./components/SupportPortal.jsx'))
const SystemAdministrationContent = lazy(() => import('./components/SystemAdministrationContent.jsx'))
const PostoperativeOxygenMLUIMockup = lazy(() => import('./PostoperativeOxygenMLUIMockup.jsx'))
const TrainingPortal = lazy(() => import('./TrainingPortal.jsx'))

export default function App() {
  return (
    <BrowserRouter>
      <IdleSessionTimeout />
      <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#f8fbff] text-[15px] font-black text-[#071b49]">Loading...</main>}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login_Form />} />
          <Route path="/signup" element={<Navigate to="/login" replace />} />
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
      </Suspense>
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
