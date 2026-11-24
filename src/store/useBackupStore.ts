import { create } from 'zustand'
import { deleteSnapshotData, loadIndex, loadSnapshotData, saveIndex, saveSnapshotData } from '../adapters/backupStorage'
import { BACKUP_DRIVE_FILE, findFile, upload } from '../adapters/drive'
import { addSnapshot, countsOf, emptyBackupIndex, isSameAsLatest, prepareRestore, shouldAutoBackup, type BackupIndex, type BackupReason, type SnapshotMeta } from '../core/backup'
import { migrate } from '../core/migrate'
import { newId } from '../core/schema'
import { useAppStore } from './useAppStore'
import { useSyncStore } from './useSyncStore'

export type CloudBackupStatus = 'idle' | 'uploading' | 'ok' | 'error'

interface BackupState extends BackupIndex {
  /** 已從 IndexedDB 讀進快照清單 */
  ready: boolean
  /** 上次推到 Google Drive 備份槽的結果 */
  cloudStatus: CloudBackupStatus
  cloudAt: number | null
  load: () => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
  /** 建立一份快照；資料跟最新一份相同時不重複存，回傳 null */
  backupNow: (reason: BackupReason) => Promise<SnapshotMeta | null>
  /** 自動備份：符合條件（啟用、超過 12 小時、資料有變）才會建立快照 */
  runAuto: (now?: number) => Promise<SnapshotMeta | null>
  /** 還原快照：先替目前的資料留一份快照，再換成快照內容 */
  restore: (id: string) => Promise<void>
  /** 清空（刪除所有資料後用） */
  reset: () => void
}

/** 所有讀寫 IndexedDB 的動作排隊依序執行，避免自動備份與手動操作同時改清單 */
let queue: Promise<unknown> = Promise.resolve()
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = queue.then(fn, fn)
  queue = next.catch(() => {})
  return next
}

let cloudFileId: string | null = null

const indexOf = (s: BackupState): BackupIndex => ({ enabled: s.enabled, lastAt: s.lastAt, snapshots: s.snapshots })

export const useBackupStore = create<BackupState>()((set, get) => {
  /** 已登入 Google 時，把這份快照推到 Drive 的備份槽（失敗不影響本機快照） */
  const pushCloud = async (meta: SnapshotMeta, data: unknown) => {
    const token = useSyncStore.getState().token
    if (!token) return
    set({ cloudStatus: 'uploading' })
    try {
      cloudFileId ??= await findFile(token, BACKUP_DRIVE_FILE)
      cloudFileId = await upload(token, cloudFileId, BACKUP_DRIVE_FILE, { kind: 'acacia-backup', createdAt: meta.createdAt, reason: meta.reason, data })
      set({ cloudStatus: 'ok', cloudAt: Date.now() })
    } catch (e) {
      console.error('Drive 備份上傳失敗', e)
      cloudFileId = null
      set({ cloudStatus: 'error' })
    }
  }

  const ensureLoaded = async () => {
    if (!get().ready) set({ ...(await loadIndex()), ready: true })
  }

  const snapshot = async (reason: BackupReason, now = Date.now()): Promise<SnapshotMeta | null> => {
    await ensureLoaded()
    const data = useAppStore.getState().exportData()
    if (isSameAsLatest(indexOf(get()), data)) return null
    const meta: SnapshotMeta = { id: newId(), createdAt: now, reason, dataUpdatedAt: data.updatedAt, counts: countsOf(data) }
    await saveSnapshotData(meta.id, data)
    const r = addSnapshot(get().snapshots, meta)
    const index = { ...indexOf(get()), snapshots: r.snapshots, lastAt: now }
    await saveIndex(index)
    set(index)
    await Promise.all(r.removed.map(deleteSnapshotData))
    if (reason !== 'beforeRestore') void pushCloud(meta, data)
    return meta
  }

  return {
    ...emptyBackupIndex(),
    ready: false,
    cloudStatus: 'idle',
    cloudAt: null,

    load: () => serial(ensureLoaded),

    setEnabled: (enabled) =>
      serial(async () => {
        await ensureLoaded()
        set({ enabled })
        await saveIndex(indexOf(get()))
      }),

    backupNow: (reason) => serial(() => snapshot(reason)),

    runAuto: (now = Date.now()) =>
      serial(async () => {
        await ensureLoaded()
        const data = useAppStore.getState().exportData()
        return shouldAutoBackup(indexOf(get()), data, now) ? snapshot('auto', now) : null
      }),

    restore: (id) =>
      serial(async () => {
        await ensureLoaded()
        const raw = await loadSnapshotData(id)
        if (!raw) throw new Error('snapshot missing')
        // 先驗證快照，失敗就不動目前資料
        const data = migrate(raw)
        await snapshot('beforeRestore')
        useAppStore.setState(prepareRestore(data, Date.now(), useAppStore.getState().exportData()))
      }),

    reset: () => {
      cloudFileId = null
      set({ ...emptyBackupIndex(), ready: true, cloudStatus: 'idle', cloudAt: null })
    },
  }
})

/** 等 IndexedDB 的主資料載入完成，避免把尚未載入的空資料當成目前資料 */
const hydrated = () =>
  useAppStore.persist.hasHydrated() ? Promise.resolve() : new Promise<void>((r) => useAppStore.persist.onFinishHydration(() => r()))

/** 瀏覽器有空檔時再執行，不跟畫面搶時間；Safari 沒有 requestIdleCallback，改用 setTimeout */
const whenIdle = (fn: () => void) => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 10_000 })
  else setTimeout(fn, 1500)
}

let started = false
/**
 * 開始自動備份：開啟網站時檢查一次，之後資料有變動時（等 5 秒沒再變動）再檢查。
 * 是否真的備份由 shouldAutoBackup 決定（距上次超過 12 小時、資料有變）。
 */
export function startAutoBackup() {
  if (started) return
  started = true
  const check = () => whenIdle(() => void useBackupStore.getState().runAuto().catch((e) => console.error('自動備份失敗', e)))
  void hydrated().then(check)
  let timer: ReturnType<typeof setTimeout> | undefined
  useAppStore.subscribe((s, prev) => {
    if (s.updatedAt === prev.updatedAt) return
    clearTimeout(timer)
    timer = setTimeout(check, 5000)
  })
}
