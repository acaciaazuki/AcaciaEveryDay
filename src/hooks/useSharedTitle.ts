import { useTranslation } from 'react-i18next'
import type { SharedEntry } from '../core/calendarView'

/** 共享行程顯示用的標題：忙閒顯示 busyLabel 或「忙碌」，被遮罩的標題顯示「（已隱藏）」 */
export function useSharedTitle() {
  const { t } = useTranslation()
  return (e: SharedEntry) => {
    if (e.access === 'busy') return e.busyLabel || t('sharing.busy')
    if (e.maskedFields.includes('title') || !e.item.title) return t('sharing.hiddenTitle')
    return e.item.title
  }
}
