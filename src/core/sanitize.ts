import type { CalendarEvent } from './schema'

/**
 * 本機資料讀回時的保守清理（zustand persist 讀 IndexedDB／iOS 檔案時不經過 Zod）。
 * 只處理會影響畫面的兩個選用欄位，格式不對時當作沒有，其他欄位（包含使用者自訂的內容與日後新增的欄位）一律原樣保留：
 * - deletedAt 不是有效的毫秒時間：當作沒有刪除（否則行程會同時從行事曆與「最近刪除」消失）
 * - endDateISO 不是 YYYY-MM-DD 或空字串：當作同一天
 * 沒有要清理的時候回傳原本的陣列；不是陣列就原樣回傳（不在這裡猜測或丟掉資料）。
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const validDeletedAt = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0
const validEndDate = (v: unknown) => v === '' || (typeof v === 'string' && ISO_DATE.test(v))

export function sanitizeEvents<T>(events: T): T {
  if (!Array.isArray(events)) return events
  let changed = false
  const out = events.map((e: unknown) => {
    if (!isObj(e)) return e
    const badDeleted = 'deletedAt' in e && e.deletedAt !== undefined && !validDeletedAt(e.deletedAt)
    const badEnd = 'endDateISO' in e && e.endDateISO !== undefined && !validEndDate(e.endDateISO)
    if (!badDeleted && !badEnd) return e
    changed = true
    const copy = { ...e }
    if (badDeleted) delete copy.deletedAt
    if (badEnd) delete copy.endDateISO
    return copy as unknown as CalendarEvent
  })
  return (changed ? out : events) as T
}
