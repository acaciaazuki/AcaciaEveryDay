import { z } from 'zod'
import { projectBusyBlocks, resolveCalendarItemForViewer } from './permissions'
import { roleOf, sharedCalendarItemSchema, spaceSchema, type SharedCalendarData, type SharedCalendarItem, type Space } from './sharing'

/**
 * 共享空間的同步封包（Space Sync Payload）。
 *
 * 原則：封包永遠是「針對某一位檢視者」產生的。每一筆變更都先經過
 * resolveCalendarItemForViewer 過濾與遮罩，所以 busy_only、selected_members、
 * hiddenUserIds、maskedFields 在畫面、Drive 同步、後端同步、匯出都套用同一套規則。
 *
 * 封包只包含共享行事曆資料：不含 AppData 主資料，也不含本機專屬設定（acacia-consent 等）。
 */

export const SPACE_SYNC_FORMAT = 'acacia-space-sync'
export const SPACE_SYNC_PAYLOAD_VERSION = 1

/** 只存在本機、絕不能出現在同步或匯出內容裡的 key */
export const LOCAL_ONLY_KEYS = ['acacia-consent'] as const

/** 一筆變更：就是一筆（可能已遮罩或為墓碑的）共享行程，帶 id、spaceId、version、updatedAt、deletedAt */
export const syncEntrySchema = sharedCalendarItemSchema
export type SyncEntry = SharedCalendarItem

/** 同步游標：Drive 版是毫秒時間戳記字串，後端版由伺服器決定（對用戶端不透明） */
export type SyncCursor = string

export const spaceSyncPayloadSchema = z.object({
  format: z.literal(SPACE_SYNC_FORMAT),
  payloadVersion: z.literal(SPACE_SYNC_PAYLOAD_VERSION),
  spaceId: z.string().min(1),
  /** 這份封包是替誰過濾的 */
  viewerId: z.string().min(1),
  generatedAt: z.number().int().nonnegative(),
  /** 只含這個時間點之後的變更；null 表示完整封包 */
  since: z.number().int().nonnegative().nullable(),
  /** 下一次增量拉取用的游標 */
  cursor: z.string().nullable(),
  space: spaceSchema,
  entries: z.array(syncEntrySchema),
})
export type SpaceSyncPayload = z.infer<typeof spaceSyncPayloadSchema>

export class SyncPayloadError extends Error {}

/** 驗證外部收到的封包；未知欄位（例如誤混進來的本機設定）會被捨棄 */
export function parseSpaceSyncPayload(raw: unknown): SpaceSyncPayload {
  const parsed = spaceSyncPayloadSchema.safeParse(raw)
  if (!parsed.success) throw new SyncPayloadError(parsed.error.message)
  return parsed.data
}

/** 檢查序列化後的內容是否混入本機專屬資料（測試與上傳前的保險） */
export const containsLocalOnlyData = (value: unknown) => {
  const json = JSON.stringify(value)
  return LOCAL_ONLY_KEYS.some((k) => json.includes(k))
}

/** 墓碑：只留同步需要的欄位，內容全部清空 */
export function toTombstone(item: SharedCalendarItem, deletedAt = item.deletedAt ?? item.updatedAt): SharedCalendarItem {
  return {
    id: item.id,
    spaceId: item.spaceId,
    kind: 'event',
    title: '',
    dateISO: item.dateISO,
    endDateISO: '',
    start: '',
    end: '',
    location: '',
    note: '',
    details: {},
    visibility: { mode: item.visibility.mode, allowedUserIds: [], hiddenUserIds: [], busyLabel: '', maskedFields: [] },
    createdBy: item.createdBy,
    createdAt: item.createdAt,
    version: item.version,
    updatedAt: item.updatedAt,
    deletedAt,
    ...(item.redaction && { redaction: item.redaction }),
  }
}

/**
 * 權限被收回時送給檢視者的墓碑（例如行程改成對他隱藏）。
 * 不帶日期與任何內容，只讓對方把手上的舊副本移除。
 */
function revocationTombstone(item: SharedCalendarItem): SharedCalendarItem {
  return {
    ...toTombstone(item, item.updatedAt),
    dateISO: '1970-01-01',
    visibility: { mode: 'private', allowedUserIds: [], hiddenUserIds: [], busyLabel: '', maskedFields: [] },
    redaction: 'busy',
  }
}

/** 空間資訊本身也依檢視者整理：已刪除的空間或非成員拿不到 */
const spaceForViewer = (space: Space, viewerId: string): Space | null => (roleOf(space, viewerId) ? space : null)

/** 目標空間要一起送出的忙閒投射區塊（只用資料擁有者自己的規則） */
function projectedInto(data: SharedCalendarData, spaceId: string) {
  return projectBusyBlocks({
    rules: data.busyProjectionRules.filter((r) => r.userId === data.ownerId),
    spaces: data.spaces,
    items: data.items,
    targetSpaceId: spaceId,
    includeDeleted: true,
  })
}

/** 過濾單一行程給檢視者；看不到時回傳 null（或在對方先前看得到時回傳收回用的墓碑） */
export function entryForViewer(item: SharedCalendarItem, viewerId: string, space: Space, previouslyVisible = false): SyncEntry | null {
  const r = resolveCalendarItemForViewer(item, viewerId, { space, includeDeleted: true })
  if (r) return item.deletedAt !== null ? toTombstone(r.item) : r.item
  return previouslyVisible && roleOf(space, viewerId) ? revocationTombstone(item) : null
}

export interface BuildPayloadOptions {
  data: SharedCalendarData
  spaceId: string
  viewerId: string
  now: number
  /** 只輸出這個時間點之後的變更 */
  since?: number | null
  /** 檢視者手上已有的行程 id；若現在看不到了，會送收回墓碑 */
  previouslyVisibleIds?: Iterable<string>
}

/**
 * 建立某個空間、給某位檢視者的同步封包。檢視者不是成員時回傳 null。
 * 游標只依「實際送出的變更」計算，不會因為看不到的行程被修改而透露時間點。
 */
export function buildSpaceSyncPayload(options: BuildPayloadOptions): SpaceSyncPayload | null {
  const { data, spaceId, viewerId, now, since = null } = options
  const rawSpace = data.spaces.find((s) => s.id === spaceId)
  const space = rawSpace && spaceForViewer(rawSpace, viewerId)
  if (!space) return null
  const known = new Set(options.previouslyVisibleIds ?? [])

  const candidates = [...data.items.filter((i) => i.spaceId === spaceId), ...projectedInto(data, spaceId)]
  const entries: SyncEntry[] = []
  let cursor = since
  for (const item of candidates) {
    if (since !== null && item.updatedAt <= since) continue
    const entry = entryForViewer(item, viewerId, space, known.has(item.id))
    if (!entry) continue
    entries.push(entry)
    cursor = Math.max(cursor ?? 0, item.updatedAt)
  }
  entries.sort((a, b) => a.updatedAt - b.updatedAt || a.id.localeCompare(b.id))
  return {
    format: SPACE_SYNC_FORMAT,
    payloadVersion: SPACE_SYNC_PAYLOAD_VERSION,
    spaceId,
    viewerId,
    generatedAt: now,
    since,
    cursor: cursor === null ? null : String(cursor),
    space,
    entries,
  }
}

/** 匯出／同步給某位檢視者：他所屬的每個空間各一份封包 */
export function buildViewerExport(data: SharedCalendarData, viewerId: string, now: number, since: number | null = null): SpaceSyncPayload[] {
  return data.spaces.flatMap((s) => buildSpaceSyncPayload({ data, spaceId: s.id, viewerId, now, since }) ?? [])
}

// ---------- 合併與衝突處理 ----------

export const syncConflictSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  localVersion: z.number(),
  incomingVersion: z.number(),
  localUpdatedAt: z.number(),
  incomingUpdatedAt: z.number(),
  winner: z.enum(['local', 'incoming']),
})
export type SyncConflict = z.infer<typeof syncConflictSchema>
export type ConflictWinner = SyncConflict['winner']

export interface MergeResult {
  items: SharedCalendarItem[]
  conflicts: SyncConflict[]
  /** 實際被遠端版本取代或新增的筆數 */
  applied: number
}

/** 同一次修改：版本、時間、刪除狀態、修改者都相同 */
const sameRevision = (a: SharedCalendarItem, b: SharedCalendarItem) =>
  a.version === b.version && a.updatedAt === b.updatedAt && a.deletedAt === b.deletedAt && a.updatedBy === b.updatedBy

/**
 * 決定兩個版本哪個勝出：
 * 1. version 較大者勝
 * 2. 同版本但內容不同（兩邊各自從同一版修改）→ 衝突，updatedAt 較新者勝
 * 3. 時間也相同 → 刪除優先（避免刪掉的行程又復活），再以 updatedBy 字串排序決定，確保每台裝置結果一致
 */
export function pickWinner(local: SharedCalendarItem, incoming: SharedCalendarItem): { winner: ConflictWinner; conflict: boolean } {
  if (incoming.version !== local.version) return { winner: incoming.version > local.version ? 'incoming' : 'local', conflict: false }
  if (sameRevision(local, incoming)) return { winner: 'local', conflict: false }
  if (incoming.updatedAt !== local.updatedAt) return { winner: incoming.updatedAt > local.updatedAt ? 'incoming' : 'local', conflict: true }
  if ((incoming.deletedAt !== null) !== (local.deletedAt !== null)) return { winner: incoming.deletedAt !== null ? 'incoming' : 'local', conflict: true }
  return { winner: (incoming.updatedBy ?? '') > (local.updatedBy ?? '') ? 'incoming' : 'local', conflict: true }
}

/**
 * 把收到的變更合併進本機清單。
 * - 軟刪除：墓碑也是一般的變更，依版本規則合併並保留，讓刪除能繼續傳到其他裝置
 * - 自己建立的完整資料，絕不會被遮罩過的副本蓋掉
 * - 自己建立的行程，可見性以自己為準（別人的編輯不能改可見性）
 */
export function mergeSyncEntries(local: readonly SharedCalendarItem[], incoming: readonly SyncEntry[], opts: { viewerId: string }): MergeResult {
  const byId = new Map(local.map((i) => [i.id, i]))
  const conflicts: SyncConflict[] = []
  let applied = 0

  for (const inc of incoming) {
    const cur = byId.get(inc.id)
    if (!cur) {
      byId.set(inc.id, inc)
      applied++
      continue
    }
    const ownFull = cur.createdBy === opts.viewerId && !cur.redaction
    if (ownFull && inc.redaction) continue

    const { winner, conflict } = pickWinner(cur, inc)
    if (conflict) {
      conflicts.push({
        id: cur.id,
        spaceId: cur.spaceId,
        localVersion: cur.version,
        incomingVersion: inc.version,
        localUpdatedAt: cur.updatedAt,
        incomingUpdatedAt: inc.updatedAt,
        winner,
      })
    }
    if (winner === 'incoming') {
      const keepVisibility = ownFull && inc.updatedBy !== opts.viewerId
      byId.set(inc.id, keepVisibility ? { ...inc, visibility: cur.visibility } : inc)
      applied++
    }
  }
  return { items: [...byId.values()], conflicts, applied }
}

/** 清掉超過保留期限的墓碑（所有裝置都已同步後才安全） */
export const purgeTombstones = (items: readonly SharedCalendarItem[], olderThan: number) =>
  items.filter((i) => i.deletedAt === null || i.deletedAt >= olderThan)

/**
 * 選出這位使用者可以推送的變更：
 * - 不推送過濾過的副本（redaction）與自動產生的投射區塊
 * - 只推送自己建立的，或自己有編輯權的行程
 */
export function selectPushableChanges(data: SharedCalendarData, viewerId: string, since: number | null = null): SharedCalendarItem[] {
  const spaces = new Map(data.spaces.map((s) => [s.id, s]))
  return data.items.filter((item) => {
    if (item.redaction || item.projection) return false
    if (since !== null && item.updatedAt <= since) return false
    const space = spaces.get(item.spaceId)
    if (!space) return false
    const r = resolveCalendarItemForViewer(item, viewerId, { space, includeDeleted: true })
    return !!r && (r.isOwnItem || r.canEdit)
  })
}
