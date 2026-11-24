import type { BackupReason } from './backup'
import { migrateSharedCalendarData, rekeyOwner, type SharedCalendarData } from './sharing'

/**
 * 共享空間的本機快照。存在獨立的 IndexedDB（acacia-spaces-backups），
 * 不混進主資料的快照（acacia-backups）與 Drive 備份檔（acacia_backup_v2.json）。
 * 建立時機與保留份數沿用主資料：超過 12 小時且資料有變才自動建立，最多 7 份。
 */

export interface SpacesSnapshotMeta {
  id: string
  createdAt: number
  reason: BackupReason
  dataUpdatedAt: number
  counts: { spaces: number; items: number }
}

export interface SpacesBackupIndex {
  enabled: boolean
  lastAt: number | null
  snapshots: SpacesSnapshotMeta[]
}

export const emptySpacesBackupIndex = (): SpacesBackupIndex => ({ enabled: true, lastAt: null, snapshots: [] })

/** 只算還存在的空間與行程 */
export const spacesCountsOf = (d: SharedCalendarData) => ({
  spaces: d.spaces.filter((s) => s.deletedAt === null).length,
  items: d.items.filter((i) => i.deletedAt === null).length,
})

/**
 * 還原快照：
 * 1. 驗證快照；身分已經對齊過（換了 selfId）時，把快照裡的舊身分換成現在的
 * 2. 快照裡的空間、行程、規則都重新編版本號（比目前與快照的版本都大 1）並把時間改成現在，
 *    否則下次 Drive 同步時，雲端較新的版本會把還原結果蓋回去
 * 3. 目前有、快照裡沒有的空間與行程改成軟刪除（同樣版本 +1），規則也標記刪除，刪除才會同步到其他裝置
 */
export function prepareSpacesRestore(raw: unknown, current: SharedCalendarData, now: number): SharedCalendarData {
  let snap = migrateSharedCalendarData(raw)
  snap = rekeyOwner(snap, snap.ownerId, current.ownerId)
  const self = current.ownerId

  const curSpaces = new Map(current.spaces.map((s) => [s.id, s]))
  const snapSpaceIds = new Set(snap.spaces.map((s) => s.id))
  const spaces = [
    ...snap.spaces.map((s) => ({ ...s, version: Math.max(s.version, curSpaces.get(s.id)?.version ?? 0) + 1, updatedAt: now })),
    ...current.spaces.filter((s) => !snapSpaceIds.has(s.id)).map((s) => (s.deletedAt !== null ? s : { ...s, deletedAt: now, updatedAt: now, version: s.version + 1 })),
  ]

  const curItems = new Map(current.items.map((i) => [i.id, i]))
  const snapItemIds = new Set(snap.items.map((i) => i.id))
  const items = [
    ...snap.items.map((i) => ({ ...i, version: Math.max(i.version, curItems.get(i.id)?.version ?? 0) + 1, updatedAt: now, updatedBy: self })),
    ...current.items.filter((i) => !snapItemIds.has(i.id)).map((i) => (i.deletedAt !== null ? i : { ...i, deletedAt: now, updatedAt: now, updatedBy: self, version: i.version + 1 })),
  ]

  const snapRuleIds = new Set(snap.busyProjectionRules.map((r) => r.id))
  const busyProjectionRules = [
    ...snap.busyProjectionRules.map((r) => ({ ...r, updatedAt: now })),
    ...current.busyProjectionRules.filter((r) => !snapRuleIds.has(r.id)).map((r) => (r.deletedAt !== null ? r : { ...r, deletedAt: now, updatedAt: now })),
  ]

  return { ...current, spaces, items, busyProjectionRules, updatedAt: now }
}
