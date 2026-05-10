import React from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import PostoperativeOxygenMLUIMockup from './PostoperativeOxygenMLUIMockup.jsx'
import TrainingPortal from './TrainingPortal.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <div className="p-4">
        <nav className="mb-4">
          <Link to="/" className="mr-4 text-sky-600">Home</Link>
          <Link to="/train" className="text-sky-600">Training Portal</Link>
        </nav>
        <Routes>
          <Route path="/" element={<PostoperativeOxygenMLUIMockup />} />
          <Route path="/train" element={<TrainingPortal />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
