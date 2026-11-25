/** 各頁面的程式（點進去才下載）；閒置時也會先下載好，之後切換頁面不用等（見 prefetchPages） */
export const pages = {
  calendar: () => import('../pages/CalendarPage').then((m) => m.CalendarPage),
  places: () => import('../pages/PlacesPage').then((m) => m.PlacesPage),
  tasks: () => import('../pages/TasksPage').then((m) => m.TasksPage),
  shopping: () => import('../pages/ShoppingPage').then((m) => m.ShoppingPage),
  reminders: () => import('../pages/RemindersPage').then((m) => m.RemindersPage),
  subscriptions: () => import('../pages/SubscriptionsPage').then((m) => m.SubscriptionsPage),
  inventory: () => import('../pages/InventoryPage').then((m) => m.InventoryPage),
  settings: () => import('../pages/SettingsPage').then((m) => m.SettingsPage),
}

let prefetched = false
/**
 * 瀏覽器閒置時依序先下載各頁面的程式（不執行、不顯示），之後點進去就不用等下載。
 * 一頁一頁來，不跟目前畫面搶網路與運算；網路很慢（省流量模式、2G）時不預先下載。
 */
export function prefetchPages() {
  if (prefetched) return
  prefetched = true
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (conn?.saveData || /2g/.test(conn?.effectiveType ?? '')) return
  const idle = (fn: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 5000 }) : setTimeout(fn, 1500))
  const queue = Object.values(pages)
  const next = () => {
    const load = queue.shift()
    if (!load) return
    // 下載失敗（例如離線）就算了，點進去時會再試一次
    void load().catch(() => {}).finally(() => idle(next))
  }
  idle(next)
}
