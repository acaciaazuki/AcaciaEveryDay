import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { isNativeApp } from './adapters/kv'
import { router } from './app/router'
import { AppErrorBoundary } from './components/ErrorScreen'
import { i18nReady } from './i18n'
import './index.css'
import { startAutoBackup } from './store/useBackupStore'
import { useConsentStore, whenConsented } from './store/useConsentStore'
import { startLegacySpacesMigration } from './store/legacySpacesMigration'
import { startTrashPurge } from './store/trashPurge'
import { useSyncStore } from './store/useSyncStore'

// 讀取使用條款同意紀錄；同意之前不碰 Google 登入、自動備份與同步
void useConsentStore.getState().load()
whenConsented(() => {
  // 同一個分頁重新整理時，沿用尚未過期的 Google 登入
  void useSyncStore.getState().connect(false)
  // 自動備份：開啟網站時與資料變動後，距上次超過 12 小時就在背景建立快照
  startAutoBackup()
  // 舊版的共享行事曆資料：自己建立的共享行程轉成個人行程後清掉（只做一次，失敗就略過）
  startLegacySpacesMigration()
  // 「最近刪除」滿 30 天的行程自動永久刪除
  startTrashPurge()
})

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
