import { useI18n } from '../i18n/I18nProvider'

export function LanguageSelect() {
  const { locale, setLocale, locales, t } = useI18n()
  return (
    <label className="lang-select">
      <span className="sr-only">{t('settings.language')}</span>
      <select
        value={locale}
        aria-label={t('settings.language')}
        onChange={(event) => setLocale(event.target.value)}
      >
        {locales.map((item) => (
          <option key={item.id} value={item.id}>
            {item.nativeName}
          </option>
        ))}
      </select>
    </label>
  )
}
