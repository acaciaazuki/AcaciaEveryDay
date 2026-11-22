import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router'
import './i18n'
import './index.css'
import { startAutoBackup } from './store/useBackupStore'
import { useSyncStore } from './store/useSyncStore'

// 同一個分頁重新整理時，沿用尚未過期的 Google 登入
void useSyncStore.getState().connect(false)
// 自動備份：開啟網站時與資料變動後，距上次超過 12 小時就在背景建立快照
startAutoBackup()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
