import React, { useMemo, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

const configuredFrontendUrl = import.meta.env.VITE_LOCAL_FRONTEND_URL
const configuredLocalIp = import.meta.env.VITE_LOCAL_IP

export default function LocalAccessQRCode() {
  const canvasRef = useRef(null)
  const frontendUrl = useMemo(() => getFrontendUrl(), [])

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
        <p className="text-primary fw-bold text-uppercase small mb-2 text-[12px] font-black tracking-[0.18em]">QR-code access</p>
        <h2 className="text-[22px] font-black leading-7 text-[#071b49]">Local Access QR Code</h2>
        <p className="mt-3 max-w-[680px] text-[15px] font-semibold leading-6 text-[#53668a]">
          Connect to the same local network, scan this QR code, and open the system.
        </p>

        <div className="mt-5 rounded-[12px] border border-[#d9e5f3] bg-[#f8fbff] p-4">
          <p className="mb-2 text-[12px] font-black uppercase tracking-[0.12em] text-[#64799e]">Frontend URL</p>
          <p className="break-all text-[18px] font-black leading-7 text-[#071b49]">{frontendUrl}</p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(frontendUrl)}
            className="btn btn-light fw-bold min-h-11 rounded-[10px] border border-[#c9d8eb] bg-white px-4 py-2 text-[14px] font-extrabold text-[#071b49]"
          >
            Copy URL
          </button>
          <button
            type="button"
            onClick={downloadQrCode}
            className="btn btn-primary fw-bold min-h-11 rounded-[10px] bg-[#1768f2] px-4 py-2 text-[14px] font-extrabold text-white"
          >
            Download QR image
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
      return `${protocol}//${hostname}:5173`
    }
  }
  if (configuredFrontendUrl) return configuredFrontendUrl
  if (configuredLocalIp) return `http://${configuredLocalIp}:5173`
  return 'http://localhost:5173'
}
