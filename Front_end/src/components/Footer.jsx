import React from 'react'

export default function Footer() {
  return (
    <footer className="navbar fixed-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-[#d4e157] bg-gradient-to-r from-[#d9f99d] via-[#bef264] to-[#facc15] px-4 py-2 shadow-[0_-8px_24px_rgba(77,124,15,0.16)] backdrop-blur md:px-5">
      <div className="container-fluid flex min-h-10 flex-col items-center justify-between gap-2 text-center xl:flex-row xl:text-left">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px] font-extrabold text-[#1f3b08] sm:text-[14px] xl:justify-start">
          <span>Developed by Joel Munyaneza</span>
          <span>Email: munyanezajoel11@gmail.com</span>
          <span>Tel: +250782112057</span>
          <span>Location: Kigali/Gasabo</span>
        </div>
        <p className="text-[14px] font-bold text-[#365314] sm:text-[16px]">
          ML-powered risk assessment for postoperative oxygen needs
        </p>
      </div>
    </footer>
  )
}
