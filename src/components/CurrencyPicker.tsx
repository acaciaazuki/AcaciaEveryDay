import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { currencyName, currencySymbol, CUSTOM_CURRENCY, isCurrencyCode } from '../core/format'

/**
 * 單筆記帳的幣別選擇。value 是下拉選單的值（幣別代碼、自訂符號，或 CUSTOM_CURRENCY），
 * 選「自訂」時下面多一個輸入框讓使用者打符號。
 */
export function CurrencyPicker({
  value,
  custom,
  options,
  onChange,
  onCustomChange,
}: {
  value: string
  custom: string
  options: string[]
  onChange: (v: string) => void
  onCustomChange: (v: string) => void
}) {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage ?? 'zh-TW'
  const id = useId()
  const label = (c: string) => {
    if (!isCurrencyCode(c)) return t('currency.customOption', { sym: c })
    const sym = currencySymbol(c, lng)
    return `${c}${sym !== c ? ` ${sym}` : ''} · ${currencyName(c, lng)}`
  }
  return (
    <>
      <div className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted">
        {/* label 不包住 select，螢幕閱讀器才不會把選中的幣別也念進欄位名稱 */}
        <label htmlFor={id}>{t('currency.label')}</label>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 rounded-(--radius-control) border border-line bg-oat px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-sage"
        >
          {options.map((c) => (
            <option key={c} value={c}>
              {label(c)}
            </option>
          ))}
          <option value={CUSTOM_CURRENCY}>{t('currency.custom')}</option>
        </select>
      </div>
      {value === CUSTOM_CURRENCY && (
        <div className="col-span-full grid min-w-0 gap-1.5 text-xs font-semibold text-muted">
          <label className="grid min-w-0 gap-1.5">
            {t('currency.customLabel')}
            <input
              value={custom}
              maxLength={8}
              autoFocus
              placeholder={t('currency.customPlaceholder')}
              onChange={(e) => onCustomChange(e.target.value)}
              className="w-full min-w-0 rounded-(--radius-control) border border-line bg-oat px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-sage"
            />
          </label>
          <span className="font-normal">{t('currency.customHelp')}</span>
        </div>
      )}
    </>
  )
}
