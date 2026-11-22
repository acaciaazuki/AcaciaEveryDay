export type NotifyState = 'unsupported' | 'default' | 'granted' | 'denied'

/** 瀏覽器系統通知（Web Notification）。iOS App 版之後換成本機推播 */
export const notifyState = (): NotifyState => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

/** 要在使用者按下按鈕時呼叫，瀏覽器才會跳出授權視窗 */
export async function requestNotify(): Promise<NotifyState> {
  if (typeof Notification === 'undefined') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return notifyState()
  }
}

/** tag 相同的通知會互相取代，同一條規則不會堆出一排 */
export function showNotification(title: string, body: string, tag: string) {
  if (notifyState() !== 'granted') return
  try {
    new Notification(title, { body, tag, icon: '/icon-192.png?v=2' })
  } catch {
    // 部分行動瀏覽器只允許從 Service Worker 發通知，失敗時還有頁面內的提醒橫幅
  }
}
