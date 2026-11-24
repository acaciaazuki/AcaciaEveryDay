import type { AppData } from './schema'
import { trackChanges } from './appMerge'

/** 自動備份的間隔：距離上次備份超過 12 小時才會再備份 */
export const BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000
/** 本機最多保留幾份快照，超過時刪掉最舊的 */
export const MAX_SNAPSHOTS = 7

/** auto：自動備份；manual：按「立即備份」；beforeRestore：還原前替當時的資料留一份 */
export type BackupReason = 'auto' | 'manual' | 'beforeRestore'

/** 快照清單只存摘要，完整資料另外存，打開設定頁時不用把七份資料全部讀進來 */
export interface SnapshotMeta {
  id: string
  createdAt: number
  reason: BackupReason
  /** 快照當下資料的 updatedAt，用來判斷資料有沒有變過 */
  dataUpdatedAt: number
  counts: SnapshotCounts
}

export interface SnapshotCounts {
  events: number
  tasks: number
  shopping: number
  inventory: number
  subscriptions: number
}

export interface BackupIndex {
  /** 是否啟用自動備份（每台裝置各自設定，預設開啟） */
  enabled: boolean
  /** 上次成功建立快照的時間 */
  lastAt: number | null
  /** 新的在前 */
  snapshots: SnapshotMeta[]
}

export const emptyBackupIndex = (): BackupIndex => ({ enabled: true, lastAt: null, snapshots: [] })

export const countsOf = (d: AppData): SnapshotCounts => ({
  events: d.events.length,
  tasks: d.tasks.length,
  // 記帳本包含已歸檔的週期，一起算
  shopping: d.shopping.length + d.archives.reduce((n, a) => n + a.expenses.length, 0),
  inventory: d.inventory.length,
  subscriptions: d.subscriptions.length,
})

/** 自動備份是否該執行：有啟用、本機有資料、距上次超過間隔，而且資料跟最新一份快照不同 */
export function shouldAutoBackup(index: Pick<BackupIndex, 'enabled' | 'lastAt'> & { snapshots: { dataUpdatedAt: number }[] }, data: { updatedAt: number }, now: number, interval = BACKUP_INTERVAL_MS): boolean {
  if (!index.enabled) return false
  // 從沒有改過資料（新裝置、剛清除）不備份，避免空白快照把舊的擠掉
  if (data.updatedAt === 0) return false
  if (index.lastAt !== null && now - index.lastAt < interval) return false
  return !isSameAsLatest(index, data)
}

/** 資料跟最新一份快照一模一樣時不必再存，免得七份都是同一個版本、反而把較舊的歷史擠掉 */
export const isSameAsLatest = (index: { snapshots: { dataUpdatedAt: number }[] }, data: { updatedAt: number }) => index.snapshots[0]?.dataUpdatedAt === data.updatedAt

/** 加入新快照並滾動覆蓋，回傳新的清單與要刪掉的舊快照 id */
export function addSnapshot<T extends { id: string; createdAt: number }>(snapshots: T[], meta: T, max = MAX_SNAPSHOTS): { snapshots: T[]; removed: string[] } {
  const all = [meta, ...snapshots.filter((s) => s.id !== meta.id)].sort((a, b) => b.createdAt - a.createdAt)
  return { snapshots: all.slice(0, max), removed: all.slice(max).map((s) => s.id) }
}

/**
 * 還原快照：當成「現在做的修改」。
 * - updatedAt 改成現在
 * - 有目前資料（current）時，跟目前資料比對產生逐筆的修改紀錄：還原回來、被改回去、被移除的紀錄都記成現在，
 *   同步時才會以還原結果為準；不這樣做的話，快照裡較舊的修改時間會讓雲端的版本勝出，把還原結果蓋掉
 */
export const prepareRestore = (data: AppData, now: number, current?: AppData): AppData => {
  const restored = { ...data, updatedAt: now }
  return current ? { ...restored, syncMeta: trackChanges(current, restored, now) } : restored
}
