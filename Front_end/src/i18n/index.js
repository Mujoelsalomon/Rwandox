import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import fr from './locales/fr.json'

const savedLanguage = typeof window !== 'undefined'
  ? window.localStorage.getItem('postopOxygenLanguage')
  : null

function applyDocumentLanguage(language) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    lng: savedLanguage || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  })

applyDocumentLanguage(i18n.language || savedLanguage || 'en')

i18n.on('languageChanged', (language) => {
  applyDocumentLanguage(language)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('postopOxygenLanguage', language)
  }
})

export default i18n
