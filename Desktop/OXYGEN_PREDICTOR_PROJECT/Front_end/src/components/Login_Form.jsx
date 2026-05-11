import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import postopO2Logo from '../assets/postop-o2-ai-logo.svg'

const SUPER_USER = {
  email: 'munyanezajoel3@gmail.com',
  password: 'Munyaneza@123',
  name: 'Anesthetist',
  role: 'Clinician',
}

export default function Login_Form() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetStatus, setResetStatus] = useState('')
  const [resetError, setResetError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()

    if (normalizedEmail !== SUPER_USER.email || password !== SUPER_USER.password) {
      setError('Invalid super user email or password.')
      return
    }

    window.localStorage.setItem(
      'postop_o2_session',
      JSON.stringify({
        email: SUPER_USER.email,
        name: SUPER_USER.name,
        role: SUPER_USER.role,
        rememberMe,
        loggedInAt: new Date().toISOString(),
      })
    )
    setError('')
    navigate('/')
  }

  function openResetDialog() {
    setResetEmail(email)
    setResetStatus('')
    setResetError('')
    setResetOpen(true)
  }

  function handleResetSubmit(event) {
    event.preventDefault()
    const normalizedResetEmail = resetEmail.trim().toLowerCase()

    if (!normalizedResetEmail) {
      setResetError('Enter your username or email to request a password reset.')
      setResetStatus('')
      return
    }

    setResetError('')
    setResetStatus('If this account is authorized, password reset instructions have been prepared for the administrator.')
  }

  return (
    <main className="relative flex h-screen overflow-hidden bg-[#f8fbff] text-[#071b49]">
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
          className="flex max-h-[calc(100vh-24px)] w-full max-w-[665px] flex-col overflow-hidden rounded-[18px] border border-[#dce6f2] bg-white/94 px-4 py-4 shadow-[0_20px_70px_rgba(15,35,70,0.13)] backdrop-blur sm:rounded-[22px] sm:px-8 sm:py-5 lg:px-10"
        >
          <div className="text-center">
            <img src={postopO2Logo} alt="PostOp O2 AI logo" className="mx-auto h-20 w-20 object-contain sm:h-24 sm:w-24 lg:h-28 lg:w-28" />
            <h1 className="mx-auto mt-2 max-w-[560px] text-[22px] font-black leading-tight text-[#071b49] sm:text-[29px] lg:text-[31px]">
              Clinical ML Post-op Oxygen Requirement Prediction
            </h1>
            <p className="mt-2 text-[14px] font-semibold text-[#64799e] sm:text-[16px]">
              Secure access for authorized users
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:mt-5 sm:gap-4">
            <label className="block">
              <span className="mb-2 block text-[14px] font-black text-[#071b49]">Username or Email</span>
              <span className="flex min-h-12 items-center gap-3 rounded-[10px] border border-[#cbd8e8] bg-white px-4 transition focus-within:border-[#1768f2] focus-within:ring-2 focus-within:ring-[#bfdbfe] sm:min-h-14">
                <Icon name="user" className="h-5 w-5 shrink-0 text-[#64799e]" />
                <input
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your username or email"
                  className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#071b49] outline-none placeholder:text-[#7a8aa6]"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-[14px] font-black text-[#071b49]">Password</span>
              <span className="flex min-h-12 items-center gap-3 rounded-[10px] border border-[#cbd8e8] bg-white px-4 transition focus-within:border-[#1768f2] focus-within:ring-2 focus-within:ring-[#bfdbfe] sm:min-h-14">
                <Icon name="lock" className="h-5 w-5 shrink-0 text-[#64799e]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#071b49] outline-none placeholder:text-[#7a8aa6]"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((current) => !current)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64799e] transition hover:bg-[#eef5fb] hover:text-[#1768f2] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} className="h-5 w-5" />
                </button>
              </span>
            </label>
          </div>

          {error && (
            <div className="mt-4 rounded-[10px] border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[14px] font-bold text-[#b91c1c]" role="alert">
              {error}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3 text-[14px] font-semibold text-[#53668a] sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-5 w-5 rounded border-[#a8b8ce] text-[#1768f2] accent-[#1768f2]"
              />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              onClick={openResetDialog}
              className="text-left font-black text-[#0876df] transition hover:text-[#075eb4] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe] sm:text-right"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            className="mt-5 min-h-12 w-full rounded-[10px] bg-gradient-to-r from-[#1877e8] to-[#20c3ae] px-6 py-3 text-center text-[17px] font-black text-white shadow-[0_14px_30px_rgba(24,119,232,0.22)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[#1768f2] focus:ring-offset-2 sm:min-h-14 sm:text-[18px]"
          >
            Login
          </button>
        </form>
      </section>

      {resetOpen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#071b49]/35 px-4 backdrop-blur-sm">
          <form
            onSubmit={handleResetSubmit}
            className="w-full max-w-[430px] rounded-[16px] border border-[#dce6f2] bg-white px-5 py-5 shadow-[0_20px_70px_rgba(15,35,70,0.24)] sm:px-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[20px] font-black text-[#071b49]">Reset password</h2>
                <p className="mt-1 text-[14px] font-semibold leading-6 text-[#64799e]">
                  Enter your authorized account email to start recovery.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close password reset"
                onClick={() => setResetOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64799e] transition hover:bg-[#eef5fb] hover:text-[#1768f2] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-[14px] font-black text-[#071b49]">Username or Email</span>
              <span className="flex min-h-12 items-center gap-3 rounded-[10px] border border-[#cbd8e8] bg-white px-4 transition focus-within:border-[#1768f2] focus-within:ring-2 focus-within:ring-[#bfdbfe]">
                <Icon name="user" className="h-5 w-5 shrink-0 text-[#64799e]" />
                <input
                  type="text"
                  autoComplete="username"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  placeholder="Enter your username or email"
                  className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#071b49] outline-none placeholder:text-[#7a8aa6]"
                />
              </span>
            </label>

            {resetError && (
              <div className="mt-4 rounded-[10px] border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[14px] font-bold text-[#b91c1c]" role="alert">
                {resetError}
              </div>
            )}

            {resetStatus && (
              <div className="mt-4 rounded-[10px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[14px] font-bold text-[#166534]" role="status">
                {resetStatus}
              </div>
            )}

            <button
              type="submit"
              className="mt-5 min-h-12 w-full rounded-[10px] bg-gradient-to-r from-[#1877e8] to-[#20c3ae] px-6 py-3 text-center text-[16px] font-black text-white shadow-[0_14px_30px_rgba(24,119,232,0.22)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[#1768f2] focus:ring-offset-2"
            >
              Send reset request
            </button>
          </form>
        </div>
      )}
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

  const paths = {
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    eyeOff: (
      <>
        <path d="m3 3 18 18" />
        <path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" />
        <path d="M9.9 5.3A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a18.3 18.3 0 0 1-4 4.8" />
        <path d="M6.1 6.6A18.4 18.4 0 0 0 2 12s3.5 7 10 7a10.9 10.9 0 0 0 4.1-.8" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    close: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
  }

  return <svg {...common}>{paths[name]}</svg>
}

function MoleculePattern() {
  return (
    <svg viewBox="0 0 640 460" className="h-full w-full text-[#93c5fd]">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M0 190h70l40-70h90l40 70h90l40-70h90l42 70h138" />
        <path d="M0 300h85l42 70h120l42-70h92l42 70h115" />
        <path d="M110 120 70 190l57 110" />
        <path d="M240 190 200 120" />
        <path d="M330 190 289 300" />
        <path d="M462 120 381 300" />
      </g>
      <g fill="currentColor">
        {[0, 70, 110, 200, 240, 330, 370, 462, 502, 85, 127, 247, 289, 381, 423, 538].map((x, index) => (
          <circle key={index} cx={x} cy={index < 9 ? (index % 2 ? 190 : 120) : (index % 2 ? 370 : 300)} r={7} />
        ))}
      </g>
    </svg>
  )
}

function LungWireframe() {
  return (
    <svg viewBox="0 0 620 520" className="h-full w-full text-[#bfdbfe]">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.9">
        <path d="M312 65v120c0 45-28 71-64 91-57 31-69 105-53 157 12 38 40 62 75 53 37-10 62-54 68-103 4-35-8-61-12-88-3-23 0-43 17-63" />
        <path d="M312 185c0 45 28 71 64 91 57 31 69 105 53 157-12 38-40 62-75 53-37-10-62-54-68-103-4-35 8-61 12-88 3-23 0-43-17-63" />
        <path d="M226 278 177 204l-49 71 22 108 64 105 77-31 47-74" />
        <path d="M394 278 443 204l49 71-22 108-64 105-77-31-47-74" />
        <path d="M126 276 213 488" />
        <path d="M177 204 270 486" />
        <path d="M492 276 407 488" />
        <path d="M443 204 350 486" />
        <path d="M167 371h286" />
        <path d="M192 290h236" />
      </g>
      <g fill="currentColor" opacity="0.85">
        {Array.from({ length: 70 }).map((_, index) => {
          const x = 120 + ((index * 67) % 380)
          const y = 185 + ((index * 43) % 285)
          return <circle key={index} cx={x} cy={y} r="2.5" />
        })}
      </g>
    </svg>
  )
}
