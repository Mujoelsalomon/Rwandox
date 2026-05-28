import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { getSession, isAdminSession, isSessionActive } from './authSession.js'
import AppLayout from './components/AppLayout.jsx'
import NewPredictionContent from './components/NewPredictionContent.jsx'
import ProfileContent from './components/ProfileContent.jsx'
import PredictionHistoryContent from './components/PredictionHistoryContent.jsx'
import SettingsContent from './components/SettingsContent.jsx'
import SystemAdministrationContent from './components/SystemAdministrationContent.jsx'
import Login_Form from './components/Login_Form.jsx'
import Sign_Up_Form from './components/Sign_Up_Form.jsx'
import PostoperativeOxygenMLUIMockup from './PostoperativeOxygenMLUIMockup.jsx'
import TrainingPortal from './TrainingPortal.jsx'

export default function App() {
  return (
    <BrowserRouter>
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
          path="/system-administration"
          element={(
            <ProtectedRoute>
              <AppLayout>
                <SystemAdministrationContent />
              </AppLayout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/train"
          element={(
            <ProtectedRoute adminOnly>
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

function ProtectedRoute({ adminOnly = false, children }) {
  const session = getSession()
  if (!isSessionActive(session)) {
    return <Navigate to="/login" replace />
  }
  if (adminOnly && !isAdminSession(session)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
