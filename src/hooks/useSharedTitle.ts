import { useTranslation } from 'react-i18next'
import type { SharedEntry } from '../core/calendarView'
import { useRangeText } from './useRangeText'

/**
 * 共享行程顯示用的標題：忙閒顯示 busyLabel 或「忙碌」；只顯示時間的忙碌區塊顯示時間區間（整天顯示「整天」）；
 * 被遮罩的標題顯示「（已隱藏）」。
 * 自己投射出去的區塊（有 projectedFrom）直接顯示來源行程的真實標題；其他成員的區塊本來就不帶標題，維持原本的顯示。
 */
export function useSharedTitle() {
  const { t } = useTranslation()
  const range = useRangeText()
  return (e: SharedEntry) => {
    if (e.projectedFrom && e.item.title) return e.item.title
    // 跨日（含跨午夜）的只顯示時間區塊：連日期一起顯示，例如「12/10 22:30 – 12/11 02:00」
    if (e.access === 'busy' && e.busyDisplay === 'time_only') return range({ dateISO: e.dateISO, endDateISO: e.lastDateISO, start: e.start, end: e.end })
    if (e.access === 'busy') return e.busyLabel || t('sharing.busy')
    if (e.maskedFields.includes('title') || !e.item.title) return t('sharing.hiddenTitle')
    return e.item.title
  }
}
