import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { API_BASE_URL } from '../config/api.js'
import postopO2Logo from '../assets/postop-o2-ai-logo.svg'

export default function Sign_Up_Form() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  function validatePassword(password) {
    return password.length >= 8
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedName = fullName.trim()

    if (!normalizedName) {
      setError('Full name is required.')
      return
    }

    if (!normalizedEmail) {
      setError('Email is required.')
      return
    }

    if (!validateEmail(normalizedEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    if (!password) {
      setError('Password is required.')
      return
    }

    if (!validatePassword(password)) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (!agreeTerms) {
      setError('You must agree to the terms and conditions.')
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: normalizedName, email: normalizedEmail, password }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Could not create account.')
        return
      }

      setSuccess('Account created successfully! Redirecting to login...')
      setTimeout(() => {
        navigate('/login')
      }, 1500)
    } catch (requestError) {
      console.error(requestError)
      setError('Could not connect to the authentication server.')
    }
  }

  return (
    <main className="container-fluid position-relative d-flex h-screen overflow-hidden bg-[#f8fbff] text-[#071b49]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-180px] top-[210px] h-[360px] w-[560px] opacity-30 sm:left-[-120px] sm:h-[430px] sm:w-[620px] sm:opacity-40">
          <MoleculePattern />
        </div>
        <div className="absolute right-[-260px] top-[190px] h-[420px] w-[560px] opacity-25 sm:right-[-110px] sm:h-[520px] sm:w-[620px] sm:opacity-35">
          <LungWireframe />
        </div>
        <div className="absolute left-[10%] top-[18%] hidden h-14 w-14 rounded-[12px] border-[5px] border-[#dbeafe] opacity-70 sm:block" />
        <div className="absolute right-[8%] top-[5%] hidden grid-cols-10 gap-3 opacity-50 sm:grid">
          {Array.from({ length: 60 }).map((_, index) => (
            <span key={index} className="h-1 w-1 rounded-full bg-[#bfdbfe]" />
          ))}
        </div>
      </div>

      <section className="relative z-10 flex h-full w-full items-center justify-center px-3 py-3 sm:px-4">
        <form
          onSubmit={handleSubmit}
          className="card border-0 shadow-lg rounded-4 flex max-h-[calc(100vh-24px)] w-full max-w-[665px] flex-col overflow-y-auto rounded-[18px] border border-[#dce6f2] bg-white/94 px-4 py-4 backdrop-blur sm:rounded-[22px] sm:px-8 sm:py-5 lg:px-10"
        >
          <div className="text-center">
            <img src={postopO2Logo} alt="PostOp O2 AI logo" className="mx-auto h-20 w-20 object-contain sm:h-24 sm:w-24 lg:h-28 lg:w-28" />
            <h1 className="card-title fw-black mx-auto mt-2 max-w-[560px] text-[22px] font-black leading-tight text-[#071b49] sm:text-[29px] lg:text-[31px]">
              Create Your Account
            </h1>
            <p className="mt-2 text-[14px] font-semibold text-[#64799e] sm:text-[16px]">
              Join us to use the oxygen prediction model
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:mt-5 sm:gap-4">
            <label className="block">
              <span className="form-label mb-2 block text-[14px] font-black text-[#071b49]">Full Name</span>
              <span className="input-group flex min-h-12 items-center gap-3 rounded-[10px] border border-[#cbd8e8] bg-white px-4 transition focus-within:border-[#1768f2] focus-within:ring-2 focus-within:ring-[#bfdbfe] sm:min-h-14">
                <Icon name="user" className="h-5 w-5 shrink-0 text-[#64799e]" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Enter your full name"
                  className="form-control border-0 shadow-none min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#071b49] outline-none placeholder:text-[#7a8aa6]"
                />
              </span>
            </label>

            <label className="block">
              <span className="form-label mb-2 block text-[14px] font-black text-[#071b49]">Email</span>
              <span className="input-group flex min-h-12 items-center gap-3 rounded-[10px] border border-[#cbd8e8] bg-white px-4 transition focus-within:border-[#1768f2] focus-within:ring-2 focus-within:ring-[#bfdbfe] sm:min-h-14">
                <Icon name="mail" className="h-5 w-5 shrink-0 text-[#64799e]" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email address"
                  className="form-control border-0 shadow-none min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#071b49] outline-none placeholder:text-[#7a8aa6]"
                />
              </span>
            </label>

            <label className="block">
              <span className="form-label mb-2 block text-[14px] font-black text-[#071b49]">Password</span>
              <span className="input-group flex min-h-12 items-center gap-3 rounded-[10px] border border-[#cbd8e8] bg-white px-4 transition focus-within:border-[#1768f2] focus-within:ring-2 focus-within:ring-[#bfdbfe] sm:min-h-14">
                <Icon name="lock" className="h-5 w-5 shrink-0 text-[#64799e]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a password (min 8 characters)"
                  className="form-control border-0 shadow-none min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#071b49] outline-none placeholder:text-[#7a8aa6]"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((current) => !current)}
                  className="btn btn-light flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64799e]"
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} className="h-5 w-5" />
                </button>
              </span>
            </label>

            <label className="block">
              <span className="form-label mb-2 block text-[14px] font-black text-[#071b49]">Confirm Password</span>
              <span className="input-group flex min-h-12 items-center gap-3 rounded-[10px] border border-[#cbd8e8] bg-white px-4 transition focus-within:border-[#1768f2] focus-within:ring-2 focus-within:ring-[#bfdbfe] sm:min-h-14">
                <Icon name="lock" className="h-5 w-5 shrink-0 text-[#64799e]" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm your password"
                  className="form-control border-0 shadow-none min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#071b49] outline-none placeholder:text-[#7a8aa6]"
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="btn btn-light flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64799e]"
                >
                  <Icon name={showConfirmPassword ? 'eyeOff' : 'eye'} className="h-5 w-5" />
                </button>
              </span>
            </label>
          </div>

          {error && (
            <div className="alert alert-danger rounded-4 mt-4 px-4 py-3 text-[14px] font-bold" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success rounded-4 mt-4 px-4 py-3 text-[14px] font-bold" role="status">
              {success}
            </div>
          )}

          <label className="mt-4 flex items-start gap-3">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(event) => setAgreeTerms(event.target.checked)}
              className="mt-1 h-5 w-5 rounded border-[#a8b8ce] text-[#1768f2] accent-[#1768f2]"
            />
            <span className="text-[13px] font-semibold leading-5 text-[#53668a]">
              I agree to the terms and conditions and privacy policy
            </span>
          </label>

          <button
            type="submit"
            className="btn btn-primary fw-bold mt-5 min-h-12 w-full rounded-[10px] px-6 py-3 text-center text-[17px] font-black text-white sm:min-h-14 sm:text-[18px]"
          >
            Create Account
          </button>

          <div className="mt-4 text-center text-[14px] font-semibold text-[#53668a]">
            Already have an account?{' '}
            <Link to="/login" className="font-black text-[#0876df] transition hover:text-[#075eb4] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]">
              Sign in
            </Link>
          </div>
        </form>
      </section>
    </main>
  )
}

function Icon({ name, className = '' }) {
  const common = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    viewBox: '0 0 24 24',
  }

  const icons = {
    user: <svg {...common}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    mail: <svg {...common}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>,
    lock: <svg {...common}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
    eye: <svg {...common}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
    eyeOff: <svg {...common}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.41a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>,
  }

  return icons[name] || icons.user
}

function MoleculePattern() {
  return (
    <svg viewBox="0 0 560 360" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="8" fill="#bfdbfe" opacity="0.6" />
      <circle cx="200" cy="150" r="6" fill="#93c5fd" opacity="0.5" />
      <circle cx="300" cy="120" r="7" fill="#60a5fa" opacity="0.4" />
      <circle cx="450" cy="250" r="5" fill="#93c5fd" opacity="0.5" />
      <line x1="100" y1="100" x2="200" y2="150" stroke="#bfdbfe" strokeWidth="2" opacity="0.3" />
      <line x1="200" y1="150" x2="300" y2="120" stroke="#bfdbfe" strokeWidth="2" opacity="0.3" />
      <line x1="300" y1="120" x2="450" y2="250" stroke="#bfdbfe" strokeWidth="2" opacity="0.2" />
    </svg>
  )
}

function LungWireframe() {
  return (
    <svg viewBox="0 0 560 420" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M280 50Q200 100 200 200Q200 300 280 350Q360 300 360 200Q360 100 280 50Z"
        stroke="#60a5fa"
        strokeWidth="2"
        opacity="0.3"
      />
      <path d="M240 150Q220 180 220 200Q220 250 240 280" stroke="#93c5fd" strokeWidth="1.5" opacity="0.3" />
      <path d="M320 150Q340 180 340 200Q340 250 320 280" stroke="#93c5fd" strokeWidth="1.5" opacity="0.3" />
    </svg>
  )
}
