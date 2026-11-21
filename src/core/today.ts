import type { CalendarEvent } from './schema'

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * 計算一天的節奏：作息區間內，行程實際佔用的分鐘數（重疊的行程只算一次）。
 * 舊版用「行程數 × 1.5 小時」估算，這裡改成依起訖時間計算。
 */
export function dayRhythm(events: CalendarEvent[], wake = '07:00', sleep = '23:00') {
  const lo = toMin(wake)
  const hi = toMin(sleep)
  const spans = events
    .filter((e) => e.start && e.end)
    .map((e) => [Math.max(lo, toMin(e.start)), Math.min(hi, toMin(e.end))] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0])

  let busy = 0
  let curA = -1
  let curB = -1
  for (const [a, b] of spans) {
    if (a > curB) {
      busy += curB - curA
      curA = a
      curB = b
    } else curB = Math.max(curB, b)
  }
  busy += curB - curA

  const total = hi - lo
  return { busyMinutes: busy, freeMinutes: Math.max(total - busy, 0), totalMinutes: total }
}

export type GreetingKey = 'morning' | 'afternoon' | 'evening' | 'night'
export function greetingKey(hour: number): GreetingKey {
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'night'
}

/** 依開始時間排序當天行程 */
export const eventsOn = (events: CalendarEvent[], iso: string) =>
  events.filter((e) => e.dateISO === iso).sort((a, b) => a.start.localeCompare(b.start))

/** 分鐘轉成「1.5」這種小時數字串 */
export const hours = (min: number) => String(Math.round((min / 60) * 10) / 10)
