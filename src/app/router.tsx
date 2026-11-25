import type React from 'react'
import { createBrowserRouter } from 'react-router'
import { TodayPage } from '../pages/TodayPage'
import { PageLoading } from '../components/BrandMark'
import { RouteErrorScreen } from '../components/ErrorScreen'
import { Layout } from './Layout'
import { pages } from './prefetch'

const page = (load: () => Promise<React.ComponentType>) => async () => ({ Component: await load() })

/**
 * 「今天」是首頁，直接打包；其他頁面點進去才下載（lazy），首次開啟網站要下載的程式比較少。
 * 切換頁面等待下載時，Layout 會在畫面最上方顯示載入中的進度條。
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
      { path: 'calendar', lazy: page(pages.calendar) },
      { path: 'places', lazy: page(pages.places) },
      { path: 'tasks', lazy: page(pages.tasks) },
      { path: 'shopping', lazy: page(pages.shopping) },
      { path: 'reminders', lazy: page(pages.reminders) },
      { path: 'subscriptions', lazy: page(pages.subscriptions) },
      { path: 'inventory', lazy: page(pages.inventory) },
      { path: 'settings', lazy: page(pages.settings) },
      // 隱私權政策：可直接連結的公開網址，開啟時自動跳出政策面板（全文較長，點開才下載；不預先下載）
      { path: 'privacy', lazy: async () => ({ Component: (await import('../pages/PrivacyPage')).PrivacyPage }) },
    ],
  },
])
