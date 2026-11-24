import { sharedOn, type SharedEntry } from './calendarView'
import type { Archive, CalendarEvent, Expense } from './schema'

/**
 * 購物記帳 → 行事曆的單向唯讀連動。
 *
 * 行事曆不另存一份行程副本：每次畫面計算某天的行程時，才把記帳（含已歸檔的）
 * 依日期與時間映射進來。記帳本是唯一的資料來源，在購物清單修改或刪除後，
 * 行事曆下次算出來的清單自然就跟著變，不會有兩份資料脫鉤。
 */
export interface ShoppingEntry {
  /** 記帳 id，跟購物清單同一個，前往編輯時用 ?open=<id> */
  id: string
  expense: Expense
  /** 已收進年度記帳本：一樣顯示，但只能查看 */
  archived: boolean
}

/** 行事曆上的一列：一般行程、共享空間行程（已經過權限過濾）或連動的購物記帳 */
export type AgendaItem =
  | { kind: 'event'; id: string; start: string; event: CalendarEvent }
  | { kind: 'shared'; id: string; start: string; shared: SharedEntry }
  | { kind: 'shopping'; id: string; start: string; entry: ShoppingEntry }

/** 目前的購物清單加上所有歸檔裡的記帳；沒有日期的記帳無法放進行事曆，略過 */
export function shoppingEntries(shopping: Expense[], archives: Archive[]): ShoppingEntry[] {
  const out: ShoppingEntry[] = []
  for (const e of shopping) if (e.date) out.push({ id: e.id, expense: e, archived: false })
  for (const a of archives) for (const e of a.expenses) if (e.date) out.push({ id: e.id, expense: e, archived: true })
  return out
}

/** 依日期分組，月曆一次要查 30 多天，先建索引比每格都掃一次快 */
export function indexByDate(entries: ShoppingEntry[]): Map<string, ShoppingEntry[]> {
  const map = new Map<string, ShoppingEntry[]>()
  for (const x of entries) {
    const list = map.get(x.expense.date)
    if (list) list.push(x)
    else map.set(x.expense.date, [x])
  }
  return map
}

/**
 * 某天要顯示的行程與購物記帳，依開始時間排序。
 * 沒有時間的記帳（舊資料或沒填）當作「整天」，跟沒有開始時間的行程一樣排在最前面；
 * 同一時間時依序是一般行程、共享行程、購物。
 */
export function agendaOn(events: CalendarEvent[], byDate: Map<string, ShoppingEntry[]>, iso: string, shared: readonly SharedEntry[] = []): AgendaItem[] {
  const items: AgendaItem[] = [
    ...events.filter((e) => e.dateISO === iso).map((e): AgendaItem => ({ kind: 'event', id: e.id, start: e.start, event: e })),
    ...sharedOn(shared, iso).map((x): AgendaItem => ({ kind: 'shared', id: `shared-${x.id}`, start: x.start, shared: x })),
    ...(byDate.get(iso) ?? []).map((x): AgendaItem => ({ kind: 'shopping', id: `shop-${x.id}`, start: x.expense.time, entry: x })),
  ]
  const RANK = { event: 0, shared: 1, shopping: 2 } as const
  const rank = (i: AgendaItem) => RANK[i.kind]
  return items.sort((a, b) => a.start.localeCompare(b.start) || rank(a) - rank(b))
}

/** 前往購物清單並開啟（或在年度記帳本裡標出）這一筆 */
export const shoppingPath = (x: ShoppingEntry) => `/shopping?open=${encodeURIComponent(x.id)}`
