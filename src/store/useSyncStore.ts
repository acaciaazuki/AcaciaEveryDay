import { create } from 'zustand'
import { isNativeApp } from '../adapters/kv'
import { download, DRIVE_FILE, findFile, LEGACY_DRIVE_FILE, upload } from '../adapters/drive'
import { fetchProfile, restoreToken, signIn, signOut, type GoogleProfile } from '../adapters/googleAuth'
import { migrate } from '../core/migrate'
import { mergeAppDataWithDiff } from '../core/appMerge'
import type { AppData } from '../core/schema'
import { useAppStore } from './useAppStore'

export type SyncStatus = 'signedOut' | 'connecting' | 'syncing' | 'synced' | 'error'

interface SyncState {
  status: SyncStatus
  profile: GoogleProfile | null
  lastSyncedAt: number | null
  token: string | null
  fileId: string | null
  connect: (interactive: boolean) => Promise<void>
  disconnect: () => Promise<void>
  push: () => Promise<void>
}

/** 等 IndexedDB 的本機資料載入完成，避免把尚未載入的空資料當成本機版本 */
const hydrated = () =>
  useAppStore.persist.hasHydrated() ? Promise.resolve() : new Promise<void>((r) => useAppStore.persist.onFinishHydration(() => r()))

let pushTimer: ReturnType<typeof setTimeout> | undefined
let pushing = false
/** 上傳期間又有修改：上傳完成後再同步一次，修改才不會漏掉 */
let pushAgain = false
let applyingRemote = false

/**
 * 跟雲端同步一次（登入與每次上傳都走這裡）：
 * 1. 下載雲端（沒有新版檔案時讀舊版 ACACIA 的備份）
 * 2. 跟本機逐筆合併（core/appMerge.ts）；兩台裝置各自離線修改的內容都會保留
 * 3. 合併結果跟本機不同時套用到本機（不觸發自動上傳）
 * 4. 合併結果跟雲端不同、或雲端還沒有新版檔案時上傳
 * 下載完到套用之間不會等待，期間的本機修改一定會被合併進去。
 */
async function syncWithDrive(token: string, knownFileId: string | null): Promise<string> {
  let fileId = knownFileId ?? (await findFile(token, DRIVE_FILE))
  let cloudRaw: unknown = null
  if (fileId) cloudRaw = await download(token, fileId)
  else {
    const legacyId = await findFile(token, LEGACY_DRIVE_FILE)
    if (legacyId) cloudRaw = await download(token, legacyId)
  }
  const cloud: AppData | null = cloudRaw ? migrate(cloudRaw) : null

  const local = useAppStore.getState().exportData()
  // 本機從沒有改過資料（全新安裝、updatedAt 為 0）：直接用雲端，不把空資料合併進去
  // 合併時逐筆比較就順便知道結果跟本機、雲端是否相同，不必再把整份資料轉成字串比對（資料多時會卡住畫面）
  const { data: merged, sameAsLocal, sameAsRemote } = !cloud
    ? { data: local, sameAsLocal: true, sameAsRemote: false }
    : local.updatedAt === 0 && !local.syncMeta
      ? { data: cloud, sameAsLocal: false, sameAsRemote: true }
      : mergeAppDataWithDiff(local, cloud, Date.now())
  if (!sameAsLocal) {
    applyingRemote = true
    useAppStore.setState(merged)
    applyingRemote = false
  }
  if (!fileId || !sameAsRemote) fileId = await upload(token, fileId, DRIVE_FILE, merged)
  return fileId
}

export const useSyncStore = create<SyncState>()((set, get) => ({
  status: 'signedOut',
  profile: null,
  lastSyncedAt: null,
  token: null,
  fileId: null,

  /** 登入（interactive=false 時只嘗試沿用這個分頁已有的 token） */
  connect: async (interactive) => {
    // iOS App 不支援 Google 登入（App 內嵌網頁不能做 OAuth），不嘗試連線，維持只存在本機
    if (isNativeApp()) return
    const stored = restoreToken()
    if (!stored && !interactive) return
    set({ status: 'connecting' })
    try {
      await hydrated()
      const { token } = stored ?? (await signIn())
      const profile = await fetchProfile(token)
      if (!profile) throw new Error('profile')
      set({ token, profile, status: 'syncing' })

      const fileId = await syncWithDrive(token, null)
      set({ fileId, status: 'synced', lastSyncedAt: Date.now() })
    } catch (e) {
      console.error('Drive 同步失敗', e)
      const status = get().token ? 'error' : 'signedOut'
      set({ status })
    }
  },

  disconnect: async () => {
    clearTimeout(pushTimer)
    await signOut(get().token)
    set({ status: 'signedOut', profile: null, token: null, fileId: null, lastSyncedAt: null })
  },

  /** 上傳本機修改：先下載雲端合併（另一台裝置的修改不會被蓋掉），再上傳合併結果 */
  push: async () => {
    const { token, fileId } = get()
    if (!token) return
    if (pushing) {
      pushAgain = true
      return
    }
    pushing = true
    set({ status: 'syncing' })
    try {
      do {
        pushAgain = false
        const id = await syncWithDrive(token, get().fileId ?? fileId)
        set({ fileId: id, status: 'synced', lastSyncedAt: Date.now() })
      } while (pushAgain)
    } catch (e) {
      applyingRemote = false
      console.error('Drive 同步失敗', e)
      set({ status: 'error' })
    } finally {
      pushing = false
    }
  },
}))

/** 資料有變動時，1.2 秒後自動上傳（和舊版相同） */
useAppStore.subscribe((s, prev) => {
  if (applyingRemote || s.updatedAt === prev.updatedAt) return
  if (!useSyncStore.getState().token) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void useSyncStore.getState().push(), 1200)
})
