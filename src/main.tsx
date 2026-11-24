import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router'
import './i18n'
import './index.css'
import { startAutoBackup } from './store/useBackupStore'
import { useConsentStore, whenConsented } from './store/useConsentStore'
import { startSpacesAutoBackup } from './store/useSpacesBackupStore'
import { startSpacesSync } from './store/useSpacesSyncStore'
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
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
