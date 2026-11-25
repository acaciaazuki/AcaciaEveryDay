import { create } from 'zustand'
import { isNativeApp } from '../adapters/kv'
import { download, DRIVE_FILE, findFile, isInsufficientPermission, LEGACY_DRIVE_FILE, upload } from '../adapters/drive'
import { clearStoredToken, fetchProfile, MissingDriveScopeError, restoreToken, signIn, signOut, type GoogleProfile } from '../adapters/googleAuth'
import { accountKey, loadBoundAccount, saveBoundAccount } from '../adapters/syncAccount'
import { migrate } from '../core/migrate'
import { mergeAppDataWithDiff, trackChanges } from '../core/appMerge'
import { purgeExpiredEvents } from '../core/trash'
import { emptyAppData, type AppData } from '../core/schema'
import { useAppStore } from './useAppStore'
import { useBackupStore } from './useBackupStore'

/**
 * needsPermission：已登入 Google，但沒有授權 Google 雲端硬碟（drive.appdata），要重新跳出權限勾選畫面
 * confirmAccount：登入的帳號跟這台裝置上次同步的帳號不同，等使用者決定要切換帳號還是合併
 */
export type SyncStatus = 'signedOut' | 'connecting' | 'syncing' | 'synced' | 'error' | 'needsPermission' | 'confirmAccount'

/** 登入不同帳號時的選擇：switch 清空本機改用新帳號的雲端資料；merge 把本機資料合併進新帳號；cancel 取消這次登入 */
export type AccountSwitchChoice = 'switch' | 'merge' | 'cancel'

interface SyncState {
  status: SyncStatus
  profile: GoogleProfile | null
  lastSyncedAt: number | null
  token: string | null
  fileId: string | null
  /** 等待使用者確認的新帳號（status 為 confirmAccount 時才有值） */
  accountSwitch: { name: string | null } | null
  connect: (interactive: boolean) => Promise<void>
  /** 強制顯示 Google 權限勾選畫面（prompt: 'consent'）重新授權，再同步一次 */
  reauthorize: () => Promise<void>
  /** 回答「登入了不同帳號」的確認對話框 */
  resolveAccountSwitch: (choice: AccountSwitchChoice) => Promise<void>
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

/** 本機是否有使用者的資料（全新安裝、從沒改過資料時 updatedAt 為 0 且沒有同步紀錄） */
const hasLocalData = (d: AppData) => d.updatedAt !== 0 || !!d.syncMeta

/** 已拿到 token、但還在等使用者確認帳號的登入；token 不放進 state，免得自動上傳先拿它去同步 */
interface PendingSignIn {
  token: string
  profile: GoogleProfile
  /** 帳號雜湊值（見 adapters/syncAccount）；Google 沒回傳帳號 ID 時為 null */
  key: string | null
}
let pending: PendingSignIn | null = null

/** 是否為「沒有 Google 雲端硬碟權限」的錯誤：重試同一個 token 沒用，要請使用者重新授權 */
const needsPermission = (e: unknown) => e instanceof MissingDriveScopeError || isInsufficientPermission(e)

export const useSyncStore = create<SyncState>()((set, get) => {
  /** 權限不足：丟掉沒用的 token（自動上傳也會停下），保留頭像與名字，畫面改提示重新授權 */
  const markNeedsPermission = () => {
    clearTimeout(pushTimer)
    clearStoredToken()
    set({ status: 'needsPermission', token: null, fileId: null })
  }

  /** 登入或同步失敗的共同處理；keepNeedsPermission 為 true 時（重新授權被關掉）維持「尚未授權」提示 */
  const attempt = async (fn: () => Promise<void>, keepNeedsPermission = false) => {
    try {
      await fn()
    } catch (e) {
      console.error('Drive 同步失敗', e)
      if (needsPermission(e)) return markNeedsPermission()
      if (keepNeedsPermission) return set({ status: 'needsPermission' })
      set({ status: get().token ? 'error' : 'signedOut' })
    }
  }

  /** 帳號確認完畢：同步並記下這台裝置現在綁定的帳號 */
  const finishSignIn = async ({ token, profile, key }: PendingSignIn) => {
    set({ token, profile, status: 'syncing' })
    useBackupStore.getState().forgetCloudFile()
    const fileId = await syncWithDrive(token, null)
    if (key) await saveBoundAccount(key)
    set({ fileId, status: 'synced', lastSyncedAt: Date.now() })
  }

  /**
   * 登入並同步。silent：只沿用這個分頁已有的 token；prompt：沒有 token 才跳出登入；
   * consent：一律跳出 Google 權限勾選畫面（給漏勾 Google 雲端硬碟權限的使用者補勾）。
   * 登入的帳號跟上次同步的帳號不同、且本機有資料時，不自動合併，先改成 confirmAccount 等使用者決定。
   */
  const connectWith = async (mode: 'silent' | 'prompt' | 'consent') => {
    // iOS App 不支援 Google 登入（App 內嵌網頁不能做 OAuth），不嘗試連線，維持只存在本機
    if (isNativeApp()) return
    const stored = mode === 'consent' ? null : restoreToken()
    if (!stored && mode === 'silent') return
    const prevStatus = get().status
    set({ status: 'connecting' })
    await attempt(async () => {
      await hydrated()
      const { token } = stored ?? (await signIn({ consent: mode === 'consent' }))
      const profile = await fetchProfile(token)
      if (!profile) throw new Error('profile')
      const key = profile.sub ? await accountKey(profile.sub) : null
      const bound = await loadBoundAccount()
      if (key && bound && key !== bound && hasLocalData(useAppStore.getState().exportData())) {
        pending = { token, profile, key }
        set({ status: 'confirmAccount', accountSwitch: { name: profile.name ?? null } })
        return
      }
      await finishSignIn({ token, profile, key })
    }, mode === 'consent' && prevStatus === 'needsPermission')
  }

  return {
    status: 'signedOut',
    profile: null,
    lastSyncedAt: null,
    token: null,
    fileId: null,
    accountSwitch: null,

    /** 登入（interactive=false 時只嘗試沿用這個分頁已有的 token） */
    connect: async (interactive) => connectWith(interactive ? 'prompt' : 'silent'),

    reauthorize: async () => connectWith('consent'),

    resolveAccountSwitch: async (choice) => {
      const p = pending
      pending = null
      set({ accountSwitch: null })
      if (!p) return
      if (choice === 'cancel') {
        // 取消：本機與雲端都不動，回到未登入（token 只丟掉暫存，不撤銷使用者對 ACACIA 的授權）
        clearStoredToken()
        set({ status: 'signedOut', profile: null, token: null, fileId: null, lastSyncedAt: null })
        return
      }
      set({ status: 'connecting' })
      await attempt(async () => {
        if (choice === 'switch') {
          // 先替舊帳號的本機資料留一份快照（失敗就停下來，本機資料不動），再清空本機
          await useBackupStore.getState().backupNow('beforeAccountSwitch')
          // setState 是合併：選填的 syncMeta 要明確清掉，否則本機會被當成「改過的資料」而跟新帳號合併
          applyingRemote = true
          useAppStore.setState({ ...emptyAppData(), syncMeta: undefined })
          applyingRemote = false
        }
        // 清空後本機等於全新安裝：同步時直接採用新帳號的雲端資料，雲端沒有檔案就是空白狀態
        await finishSignIn(p)
      })
    },

    disconnect: async () => {
      clearTimeout(pushTimer)
      pending = null
      await signOut(get().token)
      // 綁定帳號的紀錄刻意保留：下次登入別的帳號時才能察覺並先詢問
      set({ status: 'signedOut', profile: null, token: null, fileId: null, lastSyncedAt: null, accountSwitch: null })
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
