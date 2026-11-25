import { create } from 'zustand'
import { createDriveSyncProvider, type DriveSyncProvider } from '../adapters/sync/driveSyncProvider'
import { SyncProviderError, type SyncErrorInfo, type SyncState } from '../adapters/sync/types'
import type { SyncConflict } from '../core/syncEnvelope'
import { useSpacesStore } from './useSpacesStore'
import { useSyncStore } from './useSyncStore'

/**
 * 共享空間的 Google Drive 同步（acacia_spaces_v1.json）。
 *
 * - 跟主資料的同步（useSyncStore → acacia_data_v2.json）各自獨立，只借用它的 Google 登入 token；
 *   登出時這裡也停止
 * - 只有使用者在設定頁開啟「共享空間雲端同步」才會建立或讀寫雲端檔案（隱私權政策 3.2）
 * - 上傳內容由 driveSyncProvider 重新依權限產生（自己看得到的版本），呼叫端無法繞過過濾
 * - 時機：開啟同步與登入成功時先拉再推；資料變動 1.5 秒後自動同步；也可以手動「立即同步」
 * - 身分對齊：雲端檔案已經屬於另一個 id（另一台裝置建立的）時，這台裝置改用那個 id
 */

interface SpacesSyncState {
  state: SyncState
  lastSyncedAt: number | null
  error: SyncErrorInfo | null
  conflicts: SyncConflict[]
  /** 立即同步（未開啟或未登入時不做事） */
  syncNow: () => Promise<void>
  /** 開啟同步並馬上同步一次 */
  enable: () => Promise<void>
  /** 關閉同步；deleteRemote 為 true 時一併刪除 Drive 上的 acacia_spaces_v1.json */
  disable: (opts: { deleteRemote: boolean }) => Promise<void>
}

let provider: DriveSyncProvider = createDriveSyncProvider({ getToken: () => useSyncStore.getState().token })
/** 測試用：換成假的 Drive */
export const setSpacesSyncProvider = (p: DriveSyncProvider) => {
  provider = p
}

let running: Promise<void> | null = null
let again = false
let applyingRemote = false

const toInfo = (e: unknown): SyncErrorInfo =>
  e instanceof SyncProviderError ? e.toInfo() : { code: 'unknown', message: e instanceof Error ? e.message : String(e), retryable: false }

export const useSpacesSyncStore = create<SpacesSyncState>()((set, get) => {
  const once = async () => {
    const spaces = useSpacesStore.getState()
    // 本機資料來自較新版本：不拉也不推，提示更新 App
    if (spaces.blockedReason) {
      set({ state: 'error', error: { code: 'update_required', message: spaces.blockedReason, retryable: false } })
      return
    }
    if (!spaces.cloudSync || !useSyncStore.getState().token) return
    set({ state: 'syncing', error: null })
    try {
      // 1. 對齊身分：雲端檔案是別台裝置建立的，就改用它的 id
      const owner = await provider.peekOwner()
      if (owner && owner !== useSpacesStore.getState().selfId) useSpacesStore.getState().adoptIdentity(owner)
      const selfId = useSpacesStore.getState().selfId

      // 2. 先拉：併進本機（套用雲端資料時不觸發自動上傳）
      const pulled = await provider.pull({ viewerId: selfId, since: null })
      applyingRemote = true
      const pullConflicts = useSpacesStore.getState().applyPulled(pulled)
      // 合併完順便清掉「最近刪除」滿 30 天的行程，這次推送就會一起寫回雲端
      useSpacesStore.getState().purgeTrash()
      applyingRemote = false

      // 3. 再推：合併後的結果寫回雲端
      const pushed = await provider.push({ viewerId: selfId, data: useSpacesStore.getState().exportSpaces(), changedSince: null })
      const conflicts = [...pullConflicts, ...pushed.conflicts]
      set({ state: conflicts.length ? 'conflict' : 'idle', lastSyncedAt: Date.now(), conflicts, error: null })
    } catch (e) {
      applyingRemote = false
      const error = toInfo(e)
      set({ state: error.code === 'network' ? 'offline' : 'error', error })
    }
  }

  return {
    state: 'idle',
    lastSyncedAt: null,
    error: null,
    conflicts: [],

    // 同一時間只跑一次；跑的期間又有人要求同步，就在結束後再跑一次
    syncNow: async () => {
      if (running) {
        again = true
        return running
      }
      running = (async () => {
        do {
          again = false
          await once()
        } while (again)
      })()
      try {
        await running
      } finally {
        running = null
      }
    },

    enable: async () => {
      useSpacesStore.getState().setCloudSync(true)
      await get().syncNow()
    },

    disable: async ({ deleteRemote }) => {
      useSpacesStore.getState().setCloudSync(false)
      clearTimeout(pushTimer)
      if (running) await running
      try {
        if (deleteRemote) await provider.deleteRemote()
        else await provider.disconnect()
        set({ state: 'idle', error: null, conflicts: [], lastSyncedAt: null })
      } catch (e) {
        const error = toInfo(e)
        set({ state: error.code === 'network' ? 'offline' : 'error', error })
        throw e
      }
    },
  }
})

let pushTimer: ReturnType<typeof setTimeout> | undefined
let started = false

/**
 * 開始監聽：共享空間資料變動 1.5 秒後同步；Google 登入完成時同步一次；登出時停止。
 * 只在使用者同意使用條款之後呼叫（main.tsx）。
 */
export function startSpacesSync() {
  if (started) return
  started = true
  const sync = () => void useSpacesSyncStore.getState().syncNow()

  useSpacesStore.subscribe((s, prev) => {
    if (applyingRemote || !s.cloudSync || s.data === prev.data) return
    clearTimeout(pushTimer)
    pushTimer = setTimeout(sync, 1500)
  })
  useSyncStore.subscribe((s, prev) => {
    if (s.token && !prev.token) sync()
    if (!s.token && prev.token) {
      clearTimeout(pushTimer)
      void provider.disconnect()
      useSpacesSyncStore.setState({ state: 'idle', error: null, conflicts: [], lastSyncedAt: null })
    }
  })
  const hydrated = useSpacesStore.persist.hasHydrated() ? Promise.resolve() : new Promise<void>((r) => useSpacesStore.persist.onFinishHydration(() => r()))
  void hydrated.then(sync)
}
