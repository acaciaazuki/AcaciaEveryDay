import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { isNativeApp } from './adapters/kv'
import { prefetchPages, router } from './app/router'
import { AppErrorBoundary } from './components/ErrorScreen'
import { i18nReady } from './i18n'
import './index.css'
import { startAutoBackup } from './store/useBackupStore'
import { useConsentStore, whenConsented } from './store/useConsentStore'
import { startSpacesAutoBackup } from './store/useSpacesBackupStore'
import { startSpacesSync } from './store/useSpacesSyncStore'
import { startPersonalBusyMirror } from './store/personalBusyMirror'
import { useSyncStore } from './store/useSyncStore'

// 讀取使用條款同意紀錄；同意之前不碰 Google 登入、自動備份與同步
void useConsentStore.getState().load()
whenConsented(() => {
  // 同一個分頁重新整理時，沿用尚未過期的 Google 登入
  void useSyncStore.getState().connect(false)
  // 自動備份：開啟網站時與資料變動後，距上次超過 12 小時就在背景建立快照
  startAutoBackup()
  // 共享空間：本機自動快照；使用者開啟雲端同步時才會讀寫 acacia_spaces_v1.json
  startSpacesAutoBackup()
  startSpacesSync()
  // 個人行程變動時更新「我的行事曆」的忙碌影子（有以它為來源的投射規則時才會動作）
  startPersonalBusyMirror()
})

// 網站載入完成後，趁空檔在背景預先下載其他頁面，之後點選單不用等下載
if (document.readyState === 'complete') prefetchPages()
else window.addEventListener('load', () => prefetchPages(), { once: true })

// 網頁版：請瀏覽器把本站資料標記為「持續保存」，空間不足時不要自動清除（不會跳出詢問）。
// iOS App 的資料存在 App 自己的檔案裡，不需要。
if (!isNativeApp()) void navigator.storage?.persist?.().catch(() => {})

// 等目前語言的翻譯下載完成再畫畫面（繁體中文已打包，不用等）；下載失敗時照樣顯示，缺的文字會用繁體中文
void i18nReady.finally(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  </StrictMode>,
))
