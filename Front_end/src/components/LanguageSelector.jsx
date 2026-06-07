import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function LanguageSelector({ compact = false }) {
  const { i18n, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  function changeLanguage(language) {
    i18n.changeLanguage(language)
    setOpen(false)
  }

  return (
    <div ref={menuRef} className={`relative flex items-center gap-2 ${compact ? '' : 'flex-wrap'}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="small-text rounded-[10px] border border-[#cbd8e8] bg-white px-4 py-2 font-extrabold text-[#071b49] shadow-sm transition hover:bg-[#eef5ff]"
      >
        {t('language')}
      </button>

      {open && (
      <div
        role="menu"
        className={`absolute top-[calc(100%+8px)] z-[70] inline-flex min-w-[172px] overflow-hidden rounded-[10px] border border-[#cbd8e8] bg-white shadow-[0_14px_34px_rgba(13,28,61,0.18)] ${compact ? 'right-0' : 'left-0'}`}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => changeLanguage('en')}
          className={`small-text flex-1 px-3 py-2 font-extrabold transition ${i18n.language === 'en' ? 'bg-[#1768f2] text-white' : 'text-[#071b49] hover:bg-[#eef5ff]'}`}
        >
          English
        </button>
        <span className="w-px bg-[#cbd8e8]" aria-hidden="true" />
        <button
          type="button"
          role="menuitem"
          onClick={() => changeLanguage('fr')}
          className={`small-text flex-1 px-3 py-2 font-extrabold transition ${i18n.language === 'fr' ? 'bg-[#1768f2] text-white' : 'text-[#071b49] hover:bg-[#eef5ff]'}`}
        >
          {t('french')}
        </button>
      </div>
      )}
    </div>
  )
}
