import { createBrowserRouter } from 'react-router'
import { TodayPage } from '../pages/TodayPage'
import { PageLoading } from '../components/BrandMark'
import { RouteErrorScreen } from '../components/ErrorScreen'
import { Layout } from './Layout'

/**
 * 各頁面的程式（除了首頁「今天」）。
 * 同一個 import() 呼叫兩次只會下載一次，所以背景預先下載與點進頁面共用同一份。
 */
const pages = {
  calendar: () => import('../pages/CalendarPage').then((m) => ({ Component: m.CalendarPage })),
  places: () => import('../pages/PlacesPage').then((m) => ({ Component: m.PlacesPage })),
  tasks: () => import('../pages/TasksPage').then((m) => ({ Component: m.TasksPage })),
  shopping: () => import('../pages/ShoppingPage').then((m) => ({ Component: m.ShoppingPage })),
  reminders: () => import('../pages/RemindersPage').then((m) => ({ Component: m.RemindersPage })),
  subscriptions: () => import('../pages/SubscriptionsPage').then((m) => ({ Component: m.SubscriptionsPage })),
  inventory: () => import('../pages/InventoryPage').then((m) => ({ Component: m.InventoryPage })),
  settings: () => import('../pages/SettingsPage').then((m) => ({ Component: m.SettingsPage })),
}

/** 背景預先下載的順序：常用的頁面先下載 */
const PREFETCH_ORDER: (keyof typeof pages)[] = ['calendar', 'tasks', 'shopping', 'places', 'reminders', 'settings', 'subscriptions', 'inventory']

/**
 * 「今天」是首頁，直接打包；其他頁面不放進首次下載的程式裡（首次開啟網站比較快）。
 * 首頁顯示後，趁瀏覽器空閒時在背景逐一預先下載其他頁面（prefetchPages），
 * 之後點選單就不用等下載，按下去馬上切換。
 */
export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    // 直接開啟某一頁的網址時，該頁程式下載完成前顯示相思樹載入畫面
    HydrateFallback: PageLoading,
    // 任何頁面出錯時顯示保底畫面（可以下載資料備份），不會整頁空白
    ErrorBoundary: RouteErrorScreen,
    children: [
      { index: true, Component: TodayPage },
      { path: 'calendar', lazy: pages.calendar },
      { path: 'places', lazy: pages.places },
      { path: 'tasks', lazy: pages.tasks },
      { path: 'shopping', lazy: pages.shopping },
      { path: 'reminders', lazy: pages.reminders },
      { path: 'subscriptions', lazy: pages.subscriptions },
      { path: 'inventory', lazy: pages.inventory },
      { path: 'settings', lazy: pages.settings },
      // 隱私權政策：可直接連結的公開網址，開啟時自動跳出政策面板（全文較長，點開才下載，不預先下載）
      { path: 'privacy', lazy: async () => ({ Component: (await import('../pages/PrivacyPage')).PrivacyPage }) },
    ],
  },
])

/** 瀏覽器有空檔時再執行；Safari 沒有 requestIdleCallback，改用 setTimeout */
const whenIdle = (fn: () => void) => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 3000 })
  else setTimeout(fn, 300)
}

let prefetchStarted = false

/**
 * 背景預先下載其他頁面的程式：一次一個、每個都等瀏覽器有空檔才開始，不跟首頁畫面搶網路與運算。
 * 使用者開啟「省數據」模式時不預先下載（點進去時才下載，跟原本一樣）。
 * 下載失敗不處理：點進該頁時會再下載一次，仍失敗才由打包檔自我修復機制處理（index.html）。
 */
export function prefetchPages(load: (key: keyof typeof pages) => Promise<unknown> = (key) => pages[key]()) {
  if (prefetchStarted) return
  prefetchStarted = true
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (conn?.saveData) return
  const queue = [...PREFETCH_ORDER]
  const next = () => {
    const key = queue.shift()
    if (!key) return
    whenIdle(() => void load(key).catch(() => {}).finally(next))
  }
  next()
}
