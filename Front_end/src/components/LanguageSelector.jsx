import React from 'react'
import { useTranslation } from 'react-i18next'

export default function LanguageSelector({ compact = false }) {
  const { i18n, t } = useTranslation()

  function changeLanguage(language) {
    i18n.changeLanguage(language)
  }

  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'flex-wrap'}`} aria-label={t('language')}>
      {!compact && (
        <span className="small-text font-black text-[#071b49]">{t('language')}</span>
      )}
      <div className="inline-flex overflow-hidden rounded-[10px] border border-[#cbd8e8] bg-white shadow-sm">
        <button
          type="button"
          onClick={() => changeLanguage('en')}
          className={`small-text px-3 py-2 font-extrabold transition ${i18n.language === 'en' ? 'bg-[#1768f2] text-white' : 'text-[#071b49] hover:bg-[#eef5ff]'}`}
        >
          English
        </button>
        <span className="w-px bg-[#cbd8e8]" aria-hidden="true" />
        <button
          type="button"
          onClick={() => changeLanguage('fr')}
          className={`small-text px-3 py-2 font-extrabold transition ${i18n.language === 'fr' ? 'bg-[#1768f2] text-white' : 'text-[#071b49] hover:bg-[#eef5ff]'}`}
        >
          {t('french')}
        </button>
      </div>
    </div>
  )
}
