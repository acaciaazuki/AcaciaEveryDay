import { addDays } from './date'
import { addTo, toTotals, type Totals } from './totals'
import type { IconName } from './icons'
import type { SubCategory, SubCycle, Subscription } from './schema'

/** 每個扣款週期是幾個月 */
export const CYCLE_MONTHS: Record<SubCycle, number> = { monthly: 1, quarterly: 3, yearly: 12 }

/** 即將扣款的觀察範圍（天） */
export const UPCOMING_WINDOWS = [7, 15, 30] as const
export type UpcomingWindow = (typeof UPCOMING_WINDOWS)[number]

/** 分類的粉彩配色與圖示 */
export const SUB_STYLE: Record<SubCategory, { bg: string; fg: string; icon: IconName }> = {
  entertainment: { bg: '#fce4ec', fg: '#ad1457', icon: 'leisure' },
  tools: { bg: '#e3f2fd', fg: '#1565c0', icon: 'settings' },
  work: { bg: '#e8f5e9', fg: '#2e7d32', icon: 'work' },
  learning: { bg: '#f3e5f5', fg: '#6a1b9a', icon: 'education' },
  life: { bg: '#fff3e0', fg: '#ef6c00', icon: 'housing' },
  other: { bg: '#eceff1', fg: '#455a64', icon: 'receipt' },
}

const parse = (iso: string) => iso.split('-').map(Number) as [number, number, number]
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 以 anchor（YYYY-MM-DD）為基準加 n 個月，日期超過該月天數時取月底。
 * 一律從同一個 anchor 推算，31 號的訂閱不會因為經過 2 月就永遠變成 28 號。
 */
export function addMonths(anchor: string, n: number): string {
  const [y, m, d] = parse(anchor)
  const total = y * 12 + (m - 1) + n
  const ty = Math.floor(total / 12)
  const tm = total - ty * 12
  const last = new Date(ty, tm + 1, 0).getDate()
  return `${ty}-${pad(tm + 1)}-${pad(Math.min(d, last))}`
}

/** 兩個日期相差幾天（b − a） */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = parse(a)
  const [by, bm, bd] = parse(b)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

const monthIndex = (iso: string) => {
  const [y, m] = parse(iso)
  return y * 12 + m - 1
}

/** [from, to] 區間內所有的扣款日（含頭尾）。沒有設定扣款日的訂閱回傳空陣列 */
export function chargeDates(sub: Pick<Subscription, 'nextDate' | 'cycle'>, from: string, to: string): string[] {
  if (!sub.nextDate || from > to) return []
  const step = CYCLE_MONTHS[sub.cycle]
  // 從 from 所在月份的前一個週期開始找，避免漏掉
  let k = Math.floor((monthIndex(from) - monthIndex(sub.nextDate)) / step) - 1
  const out: string[] = []
  for (;;) {
    const d = addMonths(sub.nextDate, k * step)
    if (d > to) break
    if (d >= from) out.push(d)
    k++
  }
  return out
}

/** 今天（含）之後最近的一次扣款日。儲存的扣款日過了，會依週期自動往後推 */
export function nextCharge(sub: Pick<Subscription, 'nextDate' | 'cycle'>, todayISO: string): string {
  if (!sub.nextDate) return ''
  if (sub.nextDate >= todayISO) return sub.nextDate
  return chargeDates(sub, todayISO, addMonths(todayISO, CYCLE_MONTHS[sub.cycle]))[0] ?? ''
}

export type { Totals } from './totals'

const isActive = (s: Subscription) => s.status === 'active'

/** 本月（日曆月）會扣的總金額，只算使用中的訂閱 */
export function monthTotals(subs: Subscription[], todayISO: string, first = 'TWD'): Totals {
  const start = `${todayISO.slice(0, 7)}-01`
  const end = addDays(addMonths(start, 1), -1)
  const map = new Map<string, number>()
  for (const s of subs.filter(isActive)) {
    const n = chargeDates(s, start, end).length
    if (n) addTo(map, s.currency, s.amount * n)
  }
  return toTotals(map, first)
}

/** 一年預估支出：月繳 × 12、季繳 × 4、年繳 × 1 */
export function yearlyTotals(subs: Subscription[], first = 'TWD'): Totals {
  const map = new Map<string, number>()
  for (const s of subs.filter(isActive)) addTo(map, s.currency, (s.amount * 12) / CYCLE_MONTHS[s.cycle])
  return toTotals(map, first)
}

export interface UpcomingCharge {
  sub: Subscription
  date: string
  daysLeft: number
}

/** 未來 days 天內（含今天）會扣款的使用中訂閱，依扣款日排序 */
export function upcoming(subs: Subscription[], todayISO: string, days: number): UpcomingCharge[] {
  const until = addDays(todayISO, days)
  return subs
    .filter(isActive)
    .map((sub) => ({ sub, date: nextCharge(sub, todayISO) }))
    .filter((x) => x.date && x.date <= until)
    .map((x) => ({ ...x, daysLeft: daysBetween(todayISO, x.date) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.sub.name.localeCompare(b.sub.name))
}

/** 首次進入時帶入的範例（扣款日相對今天，版面才看得到即將扣款） */
export function sampleSubscriptions(todayISO: string, payment: string): Omit<Subscription, 'id'>[] {
  return [
    { name: 'Google Gemini', plan: 'Advanced', cat: 'tools', cycle: 'monthly', amount: 650, currency: 'TWD', nextDate: addDays(todayISO, 5), payment, status: 'active', note: '' },
    { name: 'Claude', plan: 'Pro', cat: 'work', cycle: 'monthly', amount: 20, currency: 'USD', nextDate: addDays(todayISO, 12), payment, status: 'active', note: '' },
    { name: 'Google One', plan: '2 TB', cat: 'life', cycle: 'yearly', amount: 3300, currency: 'TWD', nextDate: addDays(todayISO, 26), payment, status: 'active', note: '' },
  ]
}
