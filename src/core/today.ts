import type { CalendarEvent, Settings } from './schema'
import { busyTimesOn, coversDay, type Spanning } from './span'

/** 沒有自訂時的作息：07:00 起床、23:00 就寢 */
export const DEFAULT_WAKE = '07:00'
export const DEFAULT_SLEEP = '23:00'

/** 從設定取出起床與就寢時間，沒設定就用預設值 */
export const rhythmTimes = (settings: Pick<Settings, 'rhythm'>) => ({
  wake: settings.rhythm?.wake ?? DEFAULT_WAKE,
  sleep: settings.rhythm?.sleep ?? DEFAULT_SLEEP,
})

/** 作息總長（分鐘）；就寢早於或等於起床時當作睡到隔天 */
export function rhythmLength(wake: string, sleep: string) {
  const d = toMin(sleep) - toMin(wake)
  return d > 0 ? d : d + 24 * 60
}

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * 計算一天的節奏：作息區間內，行程實際佔用的分鐘數（重疊的行程只算一次）。
 * 舊版用「行程數 × 1.5 小時」估算，這裡改成依起訖時間計算。
 * 就寢時間早於或等於起床時間（例如 01:00）代表睡到隔天：區間延伸到隔天凌晨，
 * 但只計算這一天的行程（隔天凌晨的行程屬於隔天）。
 */
export function dayRhythm(events: readonly Pick<CalendarEvent, 'start' | 'end'>[], wake = DEFAULT_WAKE, sleep = DEFAULT_SLEEP) {
  const lo = toMin(wake)
  const hi = lo + rhythmLength(wake, sleep)
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

/**
 * 某天佔用的時段（給節奏計算）：跨日（含跨午夜）的行程只算這一天的那一段，
 * 第一天算到 24:00、最後一天從 00:00 開始、中間整天；整天行程不算時數（跟原本一樣）。
 */
export const busyTimesOnDay = (items: readonly Spanning[], iso: string) =>
  items.flatMap((x) => (coversDay(x, iso) ? [busyTimesOn(x, iso) ?? { start: '', end: '' }] : [])).sort((a, b) => a.start.localeCompare(b.start))

/** 分鐘轉成「1.5」這種小時數字串 */
export const hours = (min: number) => String(Math.round((min / 60) * 10) / 10)
