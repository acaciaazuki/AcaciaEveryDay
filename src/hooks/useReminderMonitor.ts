import { useEffect, useRef } from 'react'
import { getLocationAdapter } from '../adapters/geofence'
import { showNotification } from '../adapters/notify'
import { createTracker, hasCoords, type FireEvent } from '../core/reminders'
import i18n from '../i18n'
import { useAppStore } from '../store/useAppStore'
import { useReminderRuntime } from '../store/useReminderRuntime'

/** 發出一次提醒：頁面內橫幅 + 系統通知。測試按鈕與真正的進出偵測共用 */
export function fireReminder({ reminder, kind }: FireEvent) {
  useReminderRuntime.getState().push(reminder, kind)
  const t = i18n.t.bind(i18n)
  const items = reminder.items.join(t('reminders.itemSep'))
  showNotification(t('reminders.notify.title'), t(`reminders.notify.${kind}`, { place: reminder.place, items }), `reminder:${reminder.id}:${kind}`)
}

/**
 * 在背景監看位置。有至少一個「已啟用且有座標」的提醒才會開始定位，
 * 沒有就不碰定位權限。進出判斷在 core/reminders 的 tracker，這裡只負責接線。
 */
export function useReminderMonitor() {
  const reminders = useAppStore((s) => s.reminders)
  const setStatus = useReminderRuntime((s) => s.setStatus)
  const tracker = useRef(createTracker())
  // 只有「會影響偵測」的欄位變了才重新開始監看，勾選提醒清單不會觸發
  const watchKey = JSON.stringify(reminders.filter((r) => r.enabled && hasCoords(r)).map((r) => [r.id, r.lat, r.lng, r.radius]))

  useEffect(() => {
    if (JSON.parse(watchKey).length === 0) {
      setStatus('idle')
      return
    }
    const adapter = getLocationAdapter()
    if (!adapter.supported) {
      setStatus('unsupported')
      return
    }
    setStatus('watching')
    return adapter.watch(
      (fix) => {
        setStatus('watching')
        for (const e of tracker.current.update(useAppStore.getState().reminders, fix, new Date())) fireReminder(e)
      },
      (err) => setStatus(err === 'denied' ? 'denied' : 'error'),
    )
  }, [watchKey, setStatus])
}
