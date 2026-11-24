import { createBrowserRouter } from 'react-router'
import { TodayPage } from '../pages/TodayPage'
import { PageLoading } from '../components/BrandMark'
import { RouteErrorScreen } from '../components/ErrorScreen'
import { Layout } from './Layout'

/**
 * 「今天」是首頁，直接打包；其他頁面點進去才下載（lazy），首次開啟網站要下載的程式比較少。
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
      { path: 'calendar', lazy: async () => ({ Component: (await import('../pages/CalendarPage')).CalendarPage }) },
      { path: 'places', lazy: async () => ({ Component: (await import('../pages/PlacesPage')).PlacesPage }) },
      { path: 'tasks', lazy: async () => ({ Component: (await import('../pages/TasksPage')).TasksPage }) },
      { path: 'shopping', lazy: async () => ({ Component: (await import('../pages/ShoppingPage')).ShoppingPage }) },
      { path: 'reminders', lazy: async () => ({ Component: (await import('../pages/RemindersPage')).RemindersPage }) },
      { path: 'subscriptions', lazy: async () => ({ Component: (await import('../pages/SubscriptionsPage')).SubscriptionsPage }) },
      { path: 'inventory', lazy: async () => ({ Component: (await import('../pages/InventoryPage')).InventoryPage }) },
      { path: 'settings', lazy: async () => ({ Component: (await import('../pages/SettingsPage')).SettingsPage }) },
      // 隱私權政策：可直接連結的公開網址，開啟時自動跳出政策面板（全文較長，點開才下載）
      { path: 'privacy', lazy: async () => ({ Component: (await import('../pages/PrivacyPage')).PrivacyPage }) },
    ],
  },
])
