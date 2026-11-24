import { create } from 'zustand'
import { clearSpacesBackups, deleteSpacesSnapshot, loadSpacesIndex, loadSpacesSnapshot, saveSpacesIndex, saveSpacesSnapshot } from '../adapters/spacesBackupStorage'
import { addSnapshot, isSameAsLatest, shouldAutoBackup, type BackupReason } from '../core/backup'
import { newId } from '../core/schema'
import { emptySpacesBackupIndex, spacesCountsOf, type SpacesBackupIndex, type SpacesSnapshotMeta } from '../core/spacesBackup'
import { useSpacesStore } from './useSpacesStore'

/**
 * 共享空間的本機快照（跟主資料的自動備份分開，不上傳 acacia_backup_v2.json；
 * 開啟雲端同步時，Drive 上的 acacia_spaces_v1.json 本身就是雲端副本）。
 */
interface SpacesBackupState extends SpacesBackupIndex {
  ready: boolean
  load: () => Promise<void>
  backupNow: (reason: BackupReason) => Promise<SpacesSnapshotMeta | null>
  runAuto: (now?: number) => Promise<SpacesSnapshotMeta | null>
  /** 還原：先替目前的資料留一份快照，再換成快照內容（版本號重編，不會被同步蓋回去） */
  restore: (id: string) => Promise<void>
  reset: () => void
}

let queue: Promise<unknown> = Promise.resolve()
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = queue.then(fn, fn)
  queue = next.catch(() => {})
  return next
}

const indexOf = (s: SpacesBackupState): SpacesBackupIndex => ({ enabled: s.enabled, lastAt: s.lastAt, snapshots: s.snapshots })

export const useSpacesBackupStore = create<SpacesBackupState>()((set, get) => {
  const ensureLoaded = async () => {
    if (!get().ready) set({ ...(await loadSpacesIndex()), ready: true })
  }

  const snapshot = async (reason: BackupReason, now = Date.now()) => {
    await ensureLoaded()
    const data = useSpacesStore.getState().exportSpaces()
    if (isSameAsLatest(indexOf(get()), data)) return null
    const meta: SpacesSnapshotMeta = { id: newId(), createdAt: now, reason, dataUpdatedAt: data.updatedAt, counts: spacesCountsOf(data) }
    await saveSpacesSnapshot(meta.id, data)
    const r = addSnapshot(get().snapshots, meta)
    const index = { ...indexOf(get()), snapshots: r.snapshots, lastAt: now }
    await saveSpacesIndex(index)
    set(index)
    await Promise.all(r.removed.map(deleteSpacesSnapshot))
    return meta
  }

  return {
    ...emptySpacesBackupIndex(),
    ready: false,
    load: () => serial(ensureLoaded),
    backupNow: (reason) => serial(() => snapshot(reason)),
    runAuto: (now = Date.now()) =>
      serial(async () => {
        await ensureLoaded()
        return shouldAutoBackup(indexOf(get()), useSpacesStore.getState().exportSpaces(), now) ? snapshot('auto', now) : null
      }),
    restore: (id) =>
      serial(async () => {
        await ensureLoaded()
        const raw = await loadSpacesSnapshot(id)
        if (!raw) throw new Error('snapshot missing')
        await snapshot('beforeRestore')
        // 驗證、對齊身分與重編版本號都在 restoreSnapshot 裡；失敗時丟出錯誤，目前資料不動
        useSpacesStore.getState().restoreSnapshot(raw)
      }),
    reset: () => set({ ...emptySpacesBackupIndex(), ready: true }),
  }
})

const whenIdle = (fn: () => void) => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 10_000 })
  else setTimeout(fn, 1500)
}
const hydrated = () =>
  useSpacesStore.persist.hasHydrated() ? Promise.resolve() : new Promise<void>((r) => useSpacesStore.persist.onFinishHydration(() => r()))

let started = false
/** 開始共享空間的自動快照：開啟時檢查一次，之後資料變動 5 秒沒再變時再檢查 */
export function startSpacesAutoBackup() {
  if (started) return
  started = true
  const check = () => whenIdle(() => void useSpacesBackupStore.getState().runAuto().catch((e) => console.error('共享空間自動快照失敗', e)))
  void hydrated().then(check)
  let timer: ReturnType<typeof setTimeout> | undefined
  useSpacesStore.subscribe((s, prev) => {
    if (s.data.updatedAt === prev.data.updatedAt) return
    clearTimeout(timer)
    timer = setTimeout(check, 5000)
  })
}

export { clearSpacesBackups }
