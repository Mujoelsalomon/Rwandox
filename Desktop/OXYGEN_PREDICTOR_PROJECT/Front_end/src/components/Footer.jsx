import React from 'react'

export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#d4e157] bg-gradient-to-r from-[#d9f99d] via-[#bef264] to-[#facc15] px-4 py-2 shadow-[0_-8px_24px_rgba(77,124,15,0.16)] backdrop-blur md:px-5">
      <div className="flex min-h-10 flex-col items-center justify-between gap-1 text-center sm:flex-row sm:text-left">
        <p className="text-[16px] font-extrabold text-[#1f3b08]">
          Developed by Joel Munyaneza
        </p>
        <p className="text-[16px] font-bold text-[#365314]">
          ML-powered risk assessment for postoperative oxygen needs
        </p>
      </div>
    </footer>
  )
}
