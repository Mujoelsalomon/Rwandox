import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSession } from '../authSession.js'
import { API_BASE_URL } from '../config/api.js'
import postopO2Logo from '../assets/postop-o2-ai-logo.svg'

const SUPER_USER = {
  username: 'anesthetist',
  email: 'munyanezajoel3@gmail.com',
  password: 'Munyaneza@123',
  name: 'Anesthetist',
  role: 'Doctor',
}

export default function Login_Form() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pendingUser, setPendingUser] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpName, setHelpName] = useState('')
  const [helpEmail, setHelpEmail] = useState('')
  const [helpPriority, setHelpPriority] = useState('medium')
  const [helpMessage, setHelpMessage] = useState('')
  const [helpLoading, setHelpLoading] = useState(false)
  const [helpStatus, setHelpStatus] = useState('')
  const [helpError, setHelpError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    const normalizedLogin = email.trim().toLowerCase()

    if (!normalizedLogin || !password) {
      setError('Enter your username, user ID, or email and password.')
      return
    }

    setLoginLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: normalizedLogin, password }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Invalid username, user ID, email, or password.')
        return
      }

      if (data.user?.must_change_password) {
        setPendingUser(data.user)
        setNewPassword('')
        setConfirmPassword('')
        return
      }

      createUserSession(data.user)
      navigate('/dashboard')
    } catch (error) {
      console.error(error)
      setError('Could not connect to the authentication server.')
    } finally {
      setLoginLoading(false)
    }
  }

  function openHelpDialog() {
    setHelpName('')
    setHelpEmail(email)
    setHelpPriority('medium')
    setHelpMessage('')
    setHelpStatus('')
    setHelpError('')
    setHelpOpen(true)
  }

  async function handleHelpSubmit(event) {
    event.preventDefault()
    const normalizedHelpName = helpName.trim()
    const normalizedHelpEmail = helpEmail.trim().toLowerCase()
    const normalizedHelpMessage = helpMessage.trim()

    if (!normalizedHelpName) {
      setHelpError('Enter your full name so the administrator can follow up.')
      setHelpStatus('')
      return
    }
    if (!normalizedHelpEmail) {
      setHelpError('Enter your username, user ID, or email so the administrator can identify your account.')
      setHelpStatus('')
      return
    }
    if (!normalizedHelpMessage) {
      setHelpError('Describe the login issue so the administrator knows what to review.')
      setHelpStatus('')
      return
    }

    setHelpError('')
    setHelpStatus('')
    setHelpLoading(true)

    try {
      const body = new FormData()
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedHelpEmail)
      body.append('full_name', normalizedHelpName)
      body.append('email', isEmail ? normalizedHelpEmail : '')
      body.append('role', 'Unable to log in')
      body.append('category', 'login')
      body.append('priority', helpPriority)
      body.append('subject', `Login help requested by ${normalizedHelpName}`)
      body.append('message', `${normalizedHelpMessage}\n\nUsername, user ID, or email entered: ${normalizedHelpEmail}\n\nThis ticket was submitted from the login form and should be reviewed in the administrator support portal.`)

      const response = await fetch(`${API_BASE_URL}/api/support/tickets/`, {
        method: 'POST',
        credentials: 'include',
        body,
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Could not send the help request.')
      }

      setHelpStatus('Your help request was sent to the administrator support portal. Contact Model Administration and share your username, user ID, or email for follow-up.')
      setHelpMessage('')
    } catch (requestError) {
      console.error(requestError)
      setHelpError(requestError.message || 'Could not send the help request. Please contact Model Administration directly.')
    } finally {
      setHelpLoading(false)
    }
  }

  function createUserSession(user) {
    createSession({
      id: user?.id || '',
      user_id: user?.user_id || '',
      email: user?.email || SUPER_USER.email,
      name: user?.name || SUPER_USER.name,
      role: user?.role || SUPER_USER.role,
      username: user?.username || SUPER_USER.username,
      access_level: user?.access_level || '',
      permissions: user?.permissions || [],
      is_staff: Boolean(user?.is_staff),
      is_superuser: Boolean(user?.is_superuser),
      must_change_password: Boolean(user?.must_change_password),
      rememberMe,
    })
  }

  async function handlePasswordChange(event) {
    event.preventDefault()

    if (newPassword.length < 8) {
      setError('Your new password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }
    if (newPassword === password) {
      setError('Choose a password different from the temporary password.')
      return
    }

    setLoginLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ current_password: password, new_password: newPassword }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Could not update your password.')
        return
      }

      createUserSession(data.user)
      navigate('/dashboard')
    } catch (changeError) {
      console.error(changeError)
      setError('Could not connect to update your password.')
    } finally {
      setLoginLoading(false)
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
          onSubmit={pendingUser ? handlePasswordChange : handleSubmit}
          className="card border-0 shadow-lg rounded-4 flex max-h-[calc(100vh-24px)] w-full max-w-[665px] flex-col overflow-hidden rounded-[18px] border border-[#dce6f2] bg-white/94 px-4 py-4 backdrop-blur sm:rounded-[22px] sm:px-8 sm:py-5 lg:px-10"
        >
          <div className="text-center">
            <img src={postopO2Logo} alt="PostOp O2 AI logo" className="mx-auto h-20 w-20 object-contain sm:h-24 sm:w-24 lg:h-28 lg:w-28" />
            <h1 className="card-title fw-black mx-auto mt-2 max-w-[560px] text-[22px] font-black leading-tight text-[#071b49] sm:text-[29px] lg:text-[31px]">
              A Machine Learning Model for Predicting Postoperative Oxygen Requirement Among Surgical Patients in Rwanda
            </h1>
          </div>

          {pendingUser && (
            <div className="alert alert-info rounded-4 mt-4 px-4 py-3 text-[14px] font-bold" role="status">
              Welcome {pendingUser.name}. Create your own password to finish first login.
            </div>
          )}

          {!pendingUser ? (
          <>
          <div className="mt-4 grid gap-3 sm:mt-5 sm:gap-4">
            <label className="block">
              <span className="form-label mb-2 block text-[14px] font-black text-[#071b49]">Username, User ID, or Email</span>
              <span className="input-group flex min-h-12 items-center gap-3 rounded-[10px] border border-[#cbd8e8] bg-white px-4 transition focus-within:border-[#1768f2] focus-within:ring-2 focus-within:ring-[#bfdbfe] sm:min-h-14">
                <Icon name="user" className="h-5 w-5 shrink-0 text-[#64799e]" />
                <input
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your username, user ID, or email"
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
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
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
          </div>

          {error && (
            <div className="alert alert-danger rounded-4 mt-4 px-4 py-3 text-[14px] font-bold" role="alert">
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
          </div>
          </>
          ) : (
          <div className="mt-4 grid gap-3 sm:mt-5 sm:gap-4">
            <label className="block">
              <span className="form-label mb-2 block text-[14px] font-black text-[#071b49]">New Password</span>
              <span className="input-group flex min-h-12 items-center gap-3 rounded-[10px] border border-[#cbd8e8] bg-white px-4 transition focus-within:border-[#1768f2] focus-within:ring-2 focus-within:ring-[#bfdbfe] sm:min-h-14">
                <Icon name="lock" className="h-5 w-5 shrink-0 text-[#64799e]" />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Create your new password"
                  className="form-control border-0 shadow-none min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#071b49] outline-none placeholder:text-[#7a8aa6]"
                />
              </span>
            </label>

            <label className="block">
              <span className="form-label mb-2 block text-[14px] font-black text-[#071b49]">Confirm New Password</span>
              <span className="input-group flex min-h-12 items-center gap-3 rounded-[10px] border border-[#cbd8e8] bg-white px-4 transition focus-within:border-[#1768f2] focus-within:ring-2 focus-within:ring-[#bfdbfe] sm:min-h-14">
                <Icon name="lock" className="h-5 w-5 shrink-0 text-[#64799e]" />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat your new password"
                  className="form-control border-0 shadow-none min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#071b49] outline-none placeholder:text-[#7a8aa6]"
                />
              </span>
            </label>
          </div>
          )}

          <button
            type="submit"
            disabled={loginLoading}
            className="btn btn-primary fw-bold mt-5 min-h-12 w-full rounded-[10px] px-6 py-3 text-center text-[17px] font-black text-white disabled:opacity-70 sm:min-h-14 sm:text-[18px]"
          >
            {loginLoading ? (pendingUser ? 'Saving...' : 'Verifying...') : (pendingUser ? 'Create Password and Continue' : 'Login')}
          </button>

          {!pendingUser ? (
          <button
            type="button"
            onClick={openHelpDialog}
            className="mx-auto mt-4 flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-[#f8fbff] px-4 py-2 text-[14px] font-black text-[#0876df] transition hover:border-[#93c5fd] hover:bg-[#eff6ff] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1768f2] text-white shadow-sm">
              <Icon name="help" className="h-5 w-5" />
            </span>
            <span>Help</span>
          </button>
          ) : (
          <button
            type="button"
            onClick={() => {
              setPendingUser(null)
              setNewPassword('')
              setConfirmPassword('')
              setError('')
            }}
            className="btn btn-light fw-bold mt-4 min-h-11 rounded-[10px] px-4 py-2 text-[#172a53]"
          >
            Back to login
          </button>
          )}

          <p className="mt-4 text-center text-[14px] font-semibold text-[#53668a]">
            Accounts are created by Model Administration.
          </p>
        </form>
      </section>

      {helpOpen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#071b49]/35 px-4 backdrop-blur-sm">
          <form
            onSubmit={handleHelpSubmit}
            className="card border-0 shadow-lg rounded-4 max-h-[calc(100vh-32px)] w-full max-w-[560px] overflow-y-auto rounded-[16px] border border-[#dce6f2] bg-white px-5 py-5 sm:px-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[20px] font-black text-[#071b49]">Login help</h2>
                <p className="mt-1 text-[14px] font-semibold leading-6 text-[#64799e]">
                  Send a login support ticket directly to the administrator portal.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close login help"
                onClick={() => setHelpOpen(false)}
                className="btn btn-light flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64799e]"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <label className="mt-4 block">
              <span className="form-label mb-2 block text-[14px] font-black text-[#071b49]">Full Name</span>
              <span className="input-group flex min-h-12 items-center gap-3 rounded-[10px] border border-[#cbd8e8] bg-white px-4 transition focus-within:border-[#1768f2] focus-within:ring-2 focus-within:ring-[#bfdbfe]">
                <Icon name="user" className="h-5 w-5 shrink-0 text-[#64799e]" />
                <input
                  type="text"
                  autoComplete="name"
                  value={helpName}
                  onChange={(event) => setHelpName(event.target.value)}
                  placeholder="Enter your full name"
                  className="form-control border-0 shadow-none min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#071b49] outline-none placeholder:text-[#7a8aa6]"
                />
              </span>
            </label>

            <label className="mt-4 block">
              <span className="form-label mb-2 block text-[14px] font-black text-[#071b49]">Username, User ID, or Email</span>
              <span className="input-group flex min-h-12 items-center gap-3 rounded-[10px] border border-[#cbd8e8] bg-white px-4 transition focus-within:border-[#1768f2] focus-within:ring-2 focus-within:ring-[#bfdbfe]">
                <Icon name="user" className="h-5 w-5 shrink-0 text-[#64799e]" />
                <input
                  type="text"
                  autoComplete="username"
                  value={helpEmail}
                  onChange={(event) => setHelpEmail(event.target.value)}
                  placeholder="Enter your username, user ID, or email"
                  className="form-control border-0 shadow-none min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#071b49] outline-none placeholder:text-[#7a8aa6]"
                />
              </span>
            </label>

            <label className="mt-4 block">
              <span className="form-label mb-2 block text-[14px] font-black text-[#071b49]">Priority</span>
              <select
                value={helpPriority}
                onChange={(event) => setHelpPriority(event.target.value)}
                className="form-select min-h-12 w-full rounded-[10px] border border-[#cbd8e8] bg-white px-4 text-[15px] font-semibold text-[#071b49] outline-none focus:border-[#1768f2] focus:ring-2 focus:ring-[#bfdbfe]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>

            <label className="mt-4 block">
              <span className="form-label mb-2 block text-[14px] font-black text-[#071b49]">Login Issue</span>
              <textarea
                value={helpMessage}
                onChange={(event) => setHelpMessage(event.target.value)}
                placeholder="Describe what happens when you try to log in"
                className="form-control min-h-[110px] w-full resize-y rounded-[10px] border border-[#cbd8e8] bg-white px-4 py-3 text-[15px] font-semibold text-[#071b49] outline-none placeholder:text-[#7a8aa6] focus:border-[#1768f2] focus:ring-2 focus:ring-[#bfdbfe]"
              />
            </label>

            {helpError && (
              <div className="alert alert-danger rounded-4 mt-4 px-4 py-3 text-[14px] font-bold" role="alert">
                {helpError}
              </div>
            )}

            {helpStatus && (
              <div className="alert alert-success rounded-4 mt-4 px-4 py-3 text-[14px] font-bold" role="status">
                {helpStatus}
              </div>
            )}

            <button
              type="submit"
              disabled={helpLoading}
              className="btn btn-primary fw-bold mt-5 min-h-12 w-full rounded-[10px] px-6 py-3 text-center text-[16px] font-black text-white"
            >
              {helpLoading ? 'Sending...' : 'Send support ticket'}
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
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.4 9a3 3 0 0 1 5.2 2c0 2-2.6 2.2-2.6 4" />
        <path d="M12 18h.01" />
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
