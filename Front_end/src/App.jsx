import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout.jsx'
import NewPredictionContent from './components/NewPredictionContent.jsx'
import PatientRecordsContent from './components/PatientRecordsContent.jsx'
import PredictionHistoryContent from './components/PredictionHistoryContent.jsx'
import SettingsContent from './components/SettingsContent.jsx'
import PostoperativeOxygenMLUIMockup from './PostoperativeOxygenMLUIMockup.jsx'
import TrainingPortal from './TrainingPortal.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PostoperativeOxygenMLUIMockup />} />
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
        <Route path="/train" element={<TrainingPortal />} />
      </Routes>
    </BrowserRouter>
  )
}
