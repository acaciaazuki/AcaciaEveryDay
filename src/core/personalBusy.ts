import type { CalendarEvent } from './schema'
import { PERSONAL_CALENDAR_ID, type BusyProjectionRule, type PersonalBusySlot } from './sharing'

/** 這位使用者有沒有以「我的行事曆」為來源的規則（停用的也算：停用時要靠影子送出墓碑） */
export const needsPersonalBusySlots = (rules: readonly BusyProjectionRule[], userId: string) =>
  rules.some((r) => r.userId === userId && r.sourceId === PERSONAL_CALENDAR_ID && r.deletedAt === null)

/** 同一天的行程結束日存空字串（不存 undefined），影子與行程比較時兩者視為相同 */
const endOf = (x: { dateISO: string; endDateISO?: string }) => (x.endDateISO && x.endDateISO > x.dateISO ? x.endDateISO : '')
const sameTime = (slot: PersonalBusySlot, e: Pick<CalendarEvent, 'dateISO' | 'endDateISO' | 'start' | 'end'>) =>
  slot.dateISO === e.dateISO && endOf(slot) === endOf(e) && slot.start === e.start && slot.end === e.end
/** 版本用秒數遞增，同一秒內至少 +1 */
const nextVersion = (prev: number, now: number) => Math.max(Math.floor(now / 1000), prev + 1)

/**
 * 依目前的個人行程更新忙碌影子，回傳新的陣列；沒有任何變化時回傳 null（呼叫端就不用寫入、也不會觸發同步）。
 * - 新增或時間改變的行程（含跨日的結束日）：更新日期、時間與版本
 * - 只改標題、備註、顏色：影子不變（這些內容本來就不會送出去）
 * - 刪除的行程：留下刪除標記
 * - 刪掉又加回來（同一個 id）：清掉刪除標記並提高版本
 * - 沒有日期的行程略過（舊資料可能沒有日期）
 */
export function syncPersonalBusySlots(slots: readonly PersonalBusySlot[], events: readonly CalendarEvent[], now: number): PersonalBusySlot[] | null {
  const byId = new Map(slots.map((s) => [s.id, s]))
  const alive = new Set<string>()
  let changed = false
  const next: PersonalBusySlot[] = []

  for (const e of events) {
    if (!e.dateISO || alive.has(e.id)) continue
    alive.add(e.id)
    const prev = byId.get(e.id)
    if (prev && prev.deletedAt === null && sameTime(prev, e)) {
      next.push(prev)
      continue
    }
    changed = true
    next.push({ id: e.id, dateISO: e.dateISO, ...(endOf(e) && { endDateISO: endOf(e) }), start: e.start, end: e.end, version: nextVersion(prev?.version ?? 0, now), updatedAt: now, deletedAt: null })
  }

  for (const s of slots) {
    if (alive.has(s.id)) continue
    if (s.deletedAt !== null) {
      next.push(s)
      continue
    }
    changed = true
    next.push({ ...s, version: nextVersion(s.version, now), updatedAt: now, deletedAt: now })
  }
  return changed ? next : null
}
