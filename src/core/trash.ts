import type { CalendarEvent } from './schema'
import { TOMBSTONE_TTL } from './appMerge'
import type { SharedCalendarData, SharedCalendarItem, Space } from './sharing'
import { toTombstone } from './syncEnvelope'

/**
 * 「最近刪除」（垃圾桶）：
 * - 個人行程：deletedAt 有值就在垃圾桶，畫面一律只用 liveEvents；30 天後從清單移除（同步用的刪除標記另外保留，見 appMerge）
 * - 共享行程：沿用既有的軟刪除（deletedAt 是數字時間戳，同步依版本合併）；刪除者是 updatedBy。
 *   30 天後清掉內容只留墓碑（同步時其他裝置才知道要刪），墓碑超過 TOMBSTONE_TTL 才整筆移除
 * 不依賴伺服器排程：App 啟動、雲端同步合併後、打開「最近刪除」時各清一次。
 */
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const DAY = 24 * 60 * 60 * 1000

/** 刪除時間是否有效（壞掉的資料不能讓清理或畫面出錯） */
const validTime = (t: unknown): t is number => typeof t === 'number' && Number.isFinite(t) && t >= 0

/** 已滿 30 天：該永久刪除了。時間格式壞掉時不刪（保守） */
export const isTrashExpired = (deletedAt: unknown, now: number) => validTime(deletedAt) && now - deletedAt >= TRASH_RETENTION_MS

/** 剩幾天會永久刪除（無條件進位、最少 0）；例如剛刪除是 30、剩 1 小時是 1 */
export const trashDaysLeft = (deletedAt: number, now: number) => Math.max(0, Math.ceil((deletedAt + TRASH_RETENTION_MS - now) / DAY))

const liveCache = new WeakMap<readonly CalendarEvent[], CalendarEvent[]>()
/** 還沒刪除的個人行程（同一份清單回傳同一個陣列，畫面的 memo 才不會一直重算） */
export function liveEvents(events: readonly CalendarEvent[]): CalendarEvent[] {
  let live = liveCache.get(events)
  if (!live) {
    live = events.some((e) => e.deletedAt !== undefined) ? events.filter((e) => e.deletedAt === undefined) : (events as CalendarEvent[])
    liveCache.set(events, live)
  }
  return live
}

/** 個人行程：移除在垃圾桶滿 30 天的；沒有要移除的時候回傳原本的陣列 */
export function purgeExpiredEvents(events: readonly CalendarEvent[], now: number): readonly CalendarEvent[] {
  return events.some((e) => isTrashExpired(e.deletedAt, now)) ? events.filter((e) => !isTrashExpired(e.deletedAt, now)) : events
}

/** 共享行程還保有內容（不是已清空的墓碑、不是過濾過的副本或投射區塊）：才放進「最近刪除」、才能還原 */
export const hasTrashContent = (item: SharedCalendarItem) =>
  !item.redaction && !item.projection && (item.title !== '' || item.note !== '' || item.location !== '' || Object.keys(item.details).length > 0)

/**
 * 清空內容的墓碑。版本、時間、刪除時間、刪除者（updatedBy）都不變：
 * 其他裝置合併時視為同一次修改（syncEnvelope 的 sameRevision），不會被當成衝突，也不會把內容蓋回來。
 */
export const stripToTombstone = (item: SharedCalendarItem): SharedCalendarItem => ({
  ...toTombstone(item),
  ...(item.updatedBy !== undefined && { updatedBy: item.updatedBy }),
})

/**
 * 共享行程的清理：
 * - 刪除滿 30 天、還有內容的：清成墓碑（其他裝置還沒同步到刪除時，墓碑讓它們跟著刪）
 * - 墓碑超過 TOMBSTONE_TTL（180 天）：整筆移除
 * 沒有變化時回傳原本的陣列。
 */
export function purgeSharedTrash(items: readonly SharedCalendarItem[], now: number): readonly SharedCalendarItem[] {
  let changed = false
  const out: SharedCalendarItem[] = []
  for (const item of items) {
    if (item.deletedAt === null || !validTime(item.deletedAt)) {
      out.push(item)
      continue
    }
    if (now - item.deletedAt >= TOMBSTONE_TTL) {
      changed = true
      continue
    }
    if (isTrashExpired(item.deletedAt, now) && hasTrashContent(item)) {
      changed = true
      out.push(stripToTombstone(item))
      continue
    }
    out.push(item)
  }
  return changed ? out : items
}

/** 「最近刪除」的一筆（個人或共享），畫面與測試共用 */
export type TrashEntry =
  | { kind: 'personal'; id: string; title: string; dateISO: string; start: string; end: string; deletedAt: number; event: CalendarEvent }
  | { kind: 'shared'; id: string; title: string; dateISO: string; start: string; end: string; deletedAt: number; spaceId: string; spaceName: string; deletedBy: string }

/**
 * 列出「最近刪除」：
 * - 個人行程：deletedAt 有值的
 * - 共享行程：還有內容、所在空間還在、自己有編輯權（才能還原或永久刪除）的；刪除者是 updatedBy
 * 新刪除的在前面。
 */
export function trashEntries(
  events: readonly CalendarEvent[],
  data: Pick<SharedCalendarData, 'items' | 'spaces'>,
  selfId: string,
  canEdit: (item: SharedCalendarItem, space: Space) => boolean,
): TrashEntry[] {
  const out: TrashEntry[] = []
  for (const e of events) {
    if (!validTime(e.deletedAt)) continue
    out.push({ kind: 'personal', id: e.id, title: e.title, dateISO: e.dateISO, start: e.start, end: e.end, deletedAt: e.deletedAt, event: e })
  }
  const spaces = new Map(data.spaces.map((s) => [s.id, s]))
  for (const item of data.items) {
    if (item.deletedAt === null || !validTime(item.deletedAt) || !hasTrashContent(item)) continue
    const space = spaces.get(item.spaceId)
    if (!space || space.deletedAt !== null || !space.members.some((m) => m.userId === selfId)) continue
    if (!canEdit({ ...item, deletedAt: null }, space)) continue
    out.push({
      kind: 'shared',
      id: item.id,
      title: item.title,
      dateISO: item.dateISO,
      start: item.start,
      end: item.end,
      deletedAt: item.deletedAt,
      spaceId: space.id,
      spaceName: space.name,
      deletedBy: item.updatedBy ?? item.createdBy,
    })
  }
  return out.sort((a, b) => b.deletedAt - a.deletedAt)
}
