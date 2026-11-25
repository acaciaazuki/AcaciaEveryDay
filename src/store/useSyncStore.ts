import { create } from 'zustand'
import { isNativeApp } from '../adapters/kv'
import { download, DRIVE_FILE, findFile, isInsufficientPermission, LEGACY_DRIVE_FILE, upload } from '../adapters/drive'
import { clearStoredToken, fetchProfile, MissingDriveScopeError, restoreToken, signIn, signOut, type GoogleProfile } from '../adapters/googleAuth'
import { migrate } from '../core/migrate'
import { mergeAppDataWithDiff, trackChanges } from '../core/appMerge'
import { purgeExpiredEvents } from '../core/trash'
import type { AppData } from '../core/schema'
import { useAppStore } from './useAppStore'

/** needsPermission：已登入 Google，但沒有授權 Google 雲端硬碟（drive.appdata），要重新跳出權限勾選畫面 */
export type SyncStatus = 'signedOut' | 'connecting' | 'syncing' | 'synced' | 'error' | 'needsPermission'

interface SyncState {
  status: SyncStatus
  profile: GoogleProfile | null
  lastSyncedAt: number | null
  token: string | null
  fileId: string | null
  connect: (interactive: boolean) => Promise<void>
  /** 強制顯示 Google 權限勾選畫面（prompt: 'consent'）重新授權，再同步一次 */
  reauthorize: () => Promise<void>
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
  let { data: merged, sameAsLocal, sameAsRemote } = !cloud
    ? { data: local, sameAsLocal: true, sameAsRemote: false }
    : local.updatedAt === 0 && !local.syncMeta
      ? { data: cloud, sameAsLocal: false, sameAsRemote: true }
      : mergeAppDataWithDiff(local, cloud, Date.now())
  // 合併完順便清掉「最近刪除」滿 30 天的行程（另一台裝置刪的也一樣），清理結果跟著寫回雲端
  const now = Date.now()
  const events = purgeExpiredEvents(merged.events, now)
  if (events !== merged.events) {
    const purged = { ...merged, events: [...events] }
    merged = { ...purged, syncMeta: trackChanges(merged, purged, now) }
    sameAsLocal = false
    sameAsRemote = false
  }
  if (!sameAsLocal) {
    applyingRemote = true
    useAppStore.setState(merged)
    applyingRemote = false
  }
  if (!fileId || !sameAsRemote) fileId = await upload(token, fileId, DRIVE_FILE, merged)
  return fileId
}

/** 是否為「沒有 Google 雲端硬碟權限」的錯誤：重試同一個 token 沒用，要請使用者重新授權 */
const needsPermission = (e: unknown) => e instanceof MissingDriveScopeError || isInsufficientPermission(e)

export const useSyncStore = create<SyncState>()((set, get) => {
  /** 權限不足：丟掉沒用的 token（自動上傳也會停下），保留頭像與名字，畫面改提示重新授權 */
  const markNeedsPermission = () => {
    clearTimeout(pushTimer)
    clearStoredToken()
    set({ status: 'needsPermission', token: null, fileId: null })
  }

  /**
   * 登入並同步。silent：只沿用這個分頁已有的 token；prompt：沒有 token 才跳出登入；
   * consent：一律跳出 Google 權限勾選畫面（給漏勾 Google 雲端硬碟權限的使用者補勾）。
   */
  const connectWith = async (mode: 'silent' | 'prompt' | 'consent') => {
    // iOS App 不支援 Google 登入（App 內嵌網頁不能做 OAuth），不嘗試連線，維持只存在本機
    if (isNativeApp()) return
    const stored = mode === 'consent' ? null : restoreToken()
    if (!stored && mode === 'silent') return
    const prevStatus = get().status
    set({ status: 'connecting' })
    try {
      await hydrated()
      const { token } = stored ?? (await signIn({ consent: mode === 'consent' }))
      const profile = await fetchProfile(token)
      if (!profile) throw new Error('profile')
      set({ token, profile, status: 'syncing' })

      const fileId = await syncWithDrive(token, null)
      set({ fileId, status: 'synced', lastSyncedAt: Date.now() })
    } catch (e) {
      console.error('Drive 同步失敗', e)
      if (needsPermission(e)) return markNeedsPermission()
      // 重新授權時使用者關掉視窗：回到原本的「尚未授權」提示，不要變成未登入
      if (mode === 'consent' && prevStatus === 'needsPermission') return set({ status: 'needsPermission' })
      set({ status: get().token ? 'error' : 'signedOut' })
    }
  }

  return {
    status: 'signedOut',
    profile: null,
    lastSyncedAt: null,
    token: null,
    fileId: null,

    /** 登入（interactive=false 時只嘗試沿用這個分頁已有的 token） */
    connect: async (interactive) => connectWith(interactive ? 'prompt' : 'silent'),

    reauthorize: async () => connectWith('consent'),

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
        if (needsPermission(e)) markNeedsPermission()
        else set({ status: 'error' })
      } finally {
        pushing = false
      }
    },
  }
})

/** 資料有變動時，1.2 秒後自動上傳（和舊版相同） */
useAppStore.subscribe((s, prev) => {
  if (applyingRemote || s.updatedAt === prev.updatedAt) return
  if (!useSyncStore.getState().token) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void useSyncStore.getState().push(), 1200)
})
