import { useTranslation } from 'react-i18next'
import type { SharedEntry } from '../core/calendarView'
import { formatTimeRange } from '../core/time'

/**
 * 共享行程顯示用的標題：忙閒顯示 busyLabel 或「忙碌」；只顯示時間的忙碌區塊顯示時間區間（整天顯示「整天」）；
 * 被遮罩的標題顯示「（已隱藏）」。
 * 自己投射出去的區塊（有 projectedFrom）直接顯示來源行程的真實標題；其他成員的區塊本來就不帶標題，維持原本的顯示。
 */
export function useSharedTitle() {
  const { t } = useTranslation()
  return (e: SharedEntry) => {
    if (e.projectedFrom && e.item.title) return e.item.title
    if (e.access === 'busy' && e.busyDisplay === 'time_only') return formatTimeRange(e.start, e.end) || t('event.allDay')
    if (e.access === 'busy') return e.busyLabel || t('sharing.busy')
    if (e.maskedFields.includes('title') || !e.item.title) return t('sharing.hiddenTitle')
    return e.item.title
  }
}
