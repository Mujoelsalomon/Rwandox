import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout.jsx'
import NewPredictionContent from './components/NewPredictionContent.jsx'
import PatientRecordsContent from './components/PatientRecordsContent.jsx'
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
        <Route path="/" element={<PostoperativeOxygenMLUIMockup />} />
        <Route path="/login" element={<Login_Form />} />
        <Route path="/signup" element={<Sign_Up_Form />} />
        <Route path="/signup" element={<Sign_Up_Form />} />
        <Route
          path="/new-prediction"
          element={(
            <AppLayout>
              <NewPredictionContent />
            </AppLayout>
          )}
        />
        <Route
          path="/patients"
          element={(
            <AppLayout>
              <PatientRecordsContent />
            </AppLayout>
          )}
        />
        <Route
          path="/prediction-history"
          element={(
            <AppLayout>
              <PredictionHistoryContent />
            </AppLayout>
          )}
        />
        <Route
          path="/settings"
          element={(
            <AppLayout>
              <SettingsContent />
            </AppLayout>
          )}
        />
        <Route
          path="/system-administration"
          element={(
            <AppLayout>
              <SystemAdministrationContent />
            </AppLayout>
          )}
        />
        <Route path="/train" element={<TrainingPortal />} />
      </Routes>
    </BrowserRouter>
  )
}
