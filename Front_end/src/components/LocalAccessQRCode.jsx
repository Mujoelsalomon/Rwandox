import React, { useMemo, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { API_BASE_URL } from '../config/api.js'

const configuredFrontendUrl = import.meta.env.VITE_LOCAL_FRONTEND_URL
const configuredLocalIp = import.meta.env.VITE_LOCAL_IP

export default function LocalAccessQRCode() {
  const { t } = useTranslation()
  const canvasRef = useRef(null)
  const frontendUrl = useMemo(() => getFrontendUrl(), [])
  const backendUrl = useMemo(() => getBackendUrl(frontendUrl), [frontendUrl])

  function downloadQrCode() {
    const canvas = canvasRef.current?.querySelector('canvas')
    if (!canvas) return

    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = 'local-access-qr-code.png'
    link.click()
  }

  return (
    <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(300px,0.75fr)]">
      <section className="card border-0 shadow-sm rounded-4 min-w-0 rounded-[14px] border border-[#d9e5f3] bg-white p-4 md:p-5">
        <p className="small-text text-primary fw-bold text-uppercase mb-2 font-black tracking-[0.18em]">{t('qrCodeAccess')}</p>
        <h2 className="section-title font-black text-[#071b49]">{t('qrLocalAccessTitle')}</h2>
        <p className="small-text mt-3 max-w-[680px] font-semibold text-[#53668a]">
          {t('qrLocalAccessIntro')}
        </p>

        <div className="mt-5 rounded-[12px] border border-[#d9e5f3] bg-[#f8fbff] p-4">
          <p className="table-header mb-2 font-black uppercase tracking-[0.12em] text-[#64799e]">{t('qrOpens')}</p>
          <p className="card-title break-all font-black text-[#071b49]">{frontendUrl}</p>
        </div>

        <div className="mt-3 rounded-[12px] border border-[#d9e5f3] bg-white p-4">
          <p className="table-header mb-2 font-black uppercase tracking-[0.12em] text-[#64799e]">{t('backendAutoUsed')}</p>
          <p className="body-text break-all font-black text-[#071b49]">{backendUrl}</p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(frontendUrl)}
            className="btn-text btn btn-light fw-bold min-h-11 rounded-[10px] border border-[#c9d8eb] bg-white px-4 py-2 font-extrabold text-[#071b49]"
          >
            {t('copyUrl')}
          </button>
          <button
            type="button"
            onClick={downloadQrCode}
            className="btn-text btn btn-primary fw-bold min-h-11 rounded-[10px] bg-[#1768f2] px-4 py-2 font-extrabold text-white"
          >
            {t('downloadQrImage')}
          </button>
        </div>
      </section>

      <section className="card border-0 shadow-sm rounded-4 flex min-w-0 items-center justify-center rounded-[14px] border border-[#d9e5f3] bg-white p-5">
        <div ref={canvasRef} className="rounded-[16px] border border-[#e5edf7] bg-white p-4 shadow-sm">
          <QRCodeCanvas
            value={frontendUrl}
            size={256}
            includeMargin
            level="H"
          />
        </div>
      </section>
    </div>
  )
}

function getFrontendUrl() {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol || 'http:'
    const hostname = window.location.hostname
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${window.location.host}`
    }
  }
  if (configuredFrontendUrl) return configuredFrontendUrl
  if (configuredLocalIp) return `http://${configuredLocalIp}:5173`
  return 'http://localhost:5173'
}

function getBackendUrl(frontendUrl) {
  try {
    const url = new URL(frontendUrl)
    return `${url.protocol}//${url.hostname}:8000`
  } catch {
    return API_BASE_URL
  }
}
