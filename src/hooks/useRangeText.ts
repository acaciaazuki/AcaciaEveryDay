import { useTranslation } from 'react-i18next'
import { rangeText, type Spanning } from '../core/span'

/**
 * 行程的起訖文字（清單第二行、詳細資料）：同一天「09:00–10:00」，跨日「12/10 22:30 – 12/11 02:00」，整天顯示「整天」。
 * 月日依目前語言格式化。
 */
export function useRangeText() {
  const { t, i18n } = useTranslation()
  const fmt = new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'numeric', day: 'numeric' })
  const md = (iso: string) => fmt.format(new Date(`${iso}T00:00`))
  return (x: Spanning) => rangeText(x, md) || t('event.allDay')
}
