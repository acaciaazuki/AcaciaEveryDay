import type { CalendarEvent } from './schema'

/**
 * 「最近刪除」（垃圾桶）：刪除的個人行程記下刪除時間（deletedAt），畫面一律只用 liveEvents。
 * 30 天後從清單移除；同步用的刪除標記另外由 appMerge 保留，讓其他裝置也跟著刪。
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

/** 「最近刪除」的清單：deletedAt 有值的個人行程，新刪除的在前面 */
export function trashedEvents(events: readonly CalendarEvent[]): (CalendarEvent & { deletedAt: number })[] {
  return events.filter((e): e is CalendarEvent & { deletedAt: number } => validTime(e.deletedAt)).sort((a, b) => b.deletedAt - a.deletedAt)
}
