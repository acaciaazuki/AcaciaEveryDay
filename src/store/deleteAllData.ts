import { clearBackups } from '../adapters/backupStorage'
import { clearStateStorage } from '../adapters/storage'
import { BACKUP_DRIVE_FILE, deleteFile, DRIVE_FILE, findFile, LEGACY_DRIVE_FILE, SPACES_DRIVE_FILE } from '../adapters/drive'
import { emptyAppData } from '../core/schema'
import { useAppStore } from './useAppStore'
import { useBackupStore } from './useBackupStore'
import { useConsentStore } from './useConsentStore'
import { kv } from '../adapters/kv'
import { useSyncStore } from './useSyncStore'

/** ACACIA 在 Google Drive 應用程式專用資料夾裡會用到的所有檔案（含舊版網站的同步檔、已移除的共享行事曆同步檔） */
export const CLOUD_FILES = [DRIVE_FILE, BACKUP_DRIVE_FILE, SPACES_DRIVE_FILE, LEGACY_DRIVE_FILE] as const

/** localStorage 裡的小設定（語言、字體大小、最近搜尋）都以 acacia 開頭 */
function clearLocalPrefs() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('acacia')) localStorage.removeItem(k)
  } catch {
    /* 無痕模式等情況可忽略 */
  }
}

/**
 * 刪除所有資料：
 * 1. 已登入 Google 時，先刪除 Drive 應用程式專用資料夾裡的同步檔、備份檔與舊版共享行事曆檔（失敗就停下來，本機資料不動）
 * 2. 登出並撤銷這次登入的授權
 * 3. 清空本機的主資料（含舊版留下的 acacia-spaces）、自動備份快照（含舊版共享空間快照）與小設定
 *    （iOS App 會刪掉 Library/acacia/ 底下的對應資料夾，包含損毀資料另存的備查檔）
 * 4. 清掉使用條款同意紀錄：畫面回到同意面板，跟第一次使用一樣
 * 回傳是否有刪到雲端資料
 */
export async function deleteAllData(): Promise<{ cloud: boolean }> {
  const { token, disconnect } = useSyncStore.getState()
  let cloud = false
  if (token) {
    for (const name of CLOUD_FILES) {
      // 同名檔案理論上只有一個，保險起見刪到找不到為止
      for (let id = await findFile(token, name), guard = 0; id && guard < 10; id = await findFile(token, name), guard++) {
        await deleteFile(token, id)
        cloud = true
      }
    }
    await disconnect()
  }
  await clearStateStorage()
  await clearBackups()
  // 舊版共享空間快照的位置（共享功能已移除，這裡只負責清掉）
  await kv('spacesBackups').clear()
  useBackupStore.getState().reset()
  useAppStore.setState(emptyAppData())
  clearLocalPrefs()
  await useConsentStore.getState().reset()
  return { cloud }
}
