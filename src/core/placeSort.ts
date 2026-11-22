/**
 * 最愛地點的排序（純函式，不依賴 React）。
 *
 * - 自訂順序：places 陣列本身的順序（使用者拖曳或上下移動後直接改陣列順序，
 *   所以會跟著備份與 Drive 同步，舊資料原本的順序就是自訂順序，不用轉換）。
 * - 種類：依分類清單的固定順序，同分類內維持自訂順序。
 * - 距離：需要目前位置與地點座標；沒有座標的排最後，彼此維持自訂順序。
 * - 今日營業：從「營業時間與公休」文字判讀今天的狀態，營業中排最前；
 *   判讀不出來（或沒有營業時間）的排最後並標示未知，不猜測。
 */
import { PLACE_CATEGORY_KEYS } from './categories'
import { distanceMeters, parseCoords, type LatLng } from './reminders'
import type { Place } from './schema'

export const PLACE_SORTS = ['custom', 'category', 'distance', 'open'] as const
export type PlaceSort = (typeof PLACE_SORTS)[number]

/** 地點座標：優先用存下來的 lat/lng，沒有時試著從地圖連結抓（含 @緯度,經度 的 Google 地圖網址） */
export function placeCoords(p: Pick<Place, 'lat' | 'lng' | 'url'>): LatLng | null {
  if (typeof p.lat === 'number' && typeof p.lng === 'number') return { lat: p.lat, lng: p.lng }
  return p.url ? parseCoords(p.url) : null
}

/** 穩定排序：key 相同時保留原本（自訂）順序 */
function stableSort<T>(list: readonly T[], compare: (a: T, b: T) => number): T[] {
  return list
    .map((item, i) => ({ item, i }))
    .sort((a, b) => compare(a.item, b.item) || a.i - b.i)
    .map((x) => x.item)
}

export function sortByCategory<T extends Pick<Place, 'cat'>>(places: readonly T[]): T[] {
  const rank = (cat: string) => {
    const i = (PLACE_CATEGORY_KEYS as string[]).indexOf(cat)
    return i < 0 ? PLACE_CATEGORY_KEYS.length : i
  }
  return stableSort(places, (a, b) => rank(a.cat) - rank(b.cat))
}

/** 依距離由近到遠；回傳每個地點的距離（公尺，沒有座標為 null） */
export function sortByDistance<T extends Pick<Place, 'id' | 'lat' | 'lng' | 'url'>>(places: readonly T[], here: LatLng): { sorted: T[]; distances: Map<string, number | null> } {
  const distances = new Map<string, number | null>()
  for (const p of places) {
    const c = placeCoords(p)
    distances.set(p.id, c ? distanceMeters(here, c) : null)
  }
  const d = (p: T) => distances.get(p.id) ?? Infinity
  return { sorted: stableSort(places, (a, b) => d(a) - d(b)), distances }
}

// ─── 今日營業 ──────────────────────────────────────────────

/**
 * open：現在營業中；later：今天稍後才開；ended：今天已打烊；closed：今天公休；
 * unknown：沒有營業時間，或文字判讀不出今天的時段
 */
export type OpenState = 'open' | 'later' | 'ended' | 'closed' | 'unknown'
export interface OpenStatus {
  state: OpenState
  /** later 時下一次開門的時間（HH:mm） */
  opensAt?: string
}

const OPEN_RANK: Record<OpenState, number> = { open: 0, later: 1, ended: 2, closed: 3, unknown: 4 }

/** 星期名稱（Google 地點的 weekdayDescriptions 依語系不同）→ 0（星期日）～6 */
const DAY_NAMES: [RegExp, number][] = [
  [/^(?:星期[日天]|週[日天]|周[日天]|禮拜[日天]|sunday|sun\.?|日曜日?)$/i, 0],
  [/^(?:星期一|週一|周一|禮拜一|monday|mon\.?|月曜日?)$/i, 1],
  [/^(?:星期二|週二|周二|禮拜二|tuesday|tue\.?|tues\.?|火曜日?)$/i, 2],
  [/^(?:星期三|週三|周三|禮拜三|wednesday|wed\.?|水曜日?)$/i, 3],
  [/^(?:星期四|週四|周四|禮拜四|thursday|thu\.?|thurs\.?|木曜日?)$/i, 4],
  [/^(?:星期五|週五|周五|禮拜五|friday|fri\.?|金曜日?)$/i, 5],
  [/^(?:星期六|週六|周六|禮拜六|saturday|sat\.?|土曜日?)$/i, 6],
]

const CLOSED_RE = /休息|公休|休診|休業|定休|休み|closed/i
const ALL_DAY_RE = /24\s*(?:小時|小时|時間|hours?)|全天|open\s*24/i

/** 每一行「星期X: 時段」→ { 星期: 時段文字 }。像「公休時間：星期一」這種摘要行不是星期開頭，不會被當成某天 */
export function dayLines(hours: string): Map<number, string> {
  const out = new Map<number, string>()
  for (const raw of hours.split(/\r?\n/)) {
    const m = /^\s*([^\s:：]+)\s*[:：]\s*(.*)$/.exec(raw)
    if (!m) continue
    const day = DAY_NAMES.find(([re]) => re.test(m[1]))?.[1]
    if (day !== undefined && !out.has(day)) out.set(day, m[2].trim())
  }
  return out
}

type Meridiem = 'am' | 'pm' | 'noon' | null

function meridiemOf(word: string | undefined): Meridiem {
  if (!word) return null
  const w = word.toLowerCase().replace(/\./g, '')
  if (/^(?:pm|下午|晚上|傍晚|午後)$/.test(w)) return 'pm'
  if (/^(?:am|上午|早上|凌晨|清晨|午前)$/.test(w)) return 'am'
  if (w === '中午') return 'noon'
  return null
}

function toMinutes(h: number, min: number, mer: Meridiem): number {
  let hh = h
  if (mer === 'pm' && hh < 12) hh += 12
  if (mer === 'am' && hh === 12) hh = 0
  return hh * 60 + min
}

const TOKEN_RE = /(上午|下午|中午|晚上|傍晚|早上|凌晨|清晨|午前|午後)?\s*(\d{1,2})(?:\s*[:：]\s*(\d{2})|\s*時\s*(?:(\d{1,2})\s*分)?)?\s*(a\.?m\.?|p\.?m\.?)?(?![\d])/gi

interface Token {
  h: number
  m: number
  mer: Meridiem
  /** 有分鐘、「時」或上下午才算時間，避免把其他數字當成時間 */
  isTime: boolean
}

/** 一天的時段文字 → [開始, 結束] 分鐘陣列；結束小於等於開始時表示跨夜（結束 +1440） */
export function parseRanges(text: string): [number, number][] {
  const tokens: Token[] = []
  const normalized = text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  for (const m of normalized.matchAll(TOKEN_RE)) {
    const mer = meridiemOf(m[1]) ?? meridiemOf(m[5])
    const minutes = m[3] ?? m[4]
    const isTime = minutes !== undefined || /時/.test(m[0]) || mer !== null
    tokens.push({ h: Number(m[2]), m: Number(minutes ?? 0), mer, isTime })
  }
  const times = tokens.filter((t) => t.isTime && t.h <= 24 && t.m < 60)
  const out: [number, number][] = []
  for (let i = 0; i + 1 < times.length; i += 2) {
    const a = times[i]
    const b = times[i + 1]
    // 「11:00 – 2:30 PM」這種開始時間省略上下午的寫法：沿用結束的上下午，但不能讓開始晚於結束
    let aMer = a.mer
    if (!aMer && b.mer && b.mer !== 'noon') {
      const guess = toMinutes(a.h, a.m, b.mer)
      if (guess <= toMinutes(b.h, b.m, b.mer)) aMer = b.mer
    }
    const start = toMinutes(a.h, a.m, aMer)
    let end = toMinutes(b.h, b.m, b.mer)
    if (end <= start) end += 1440
    out.push([start, end])
  }
  return out
}

const hhmm = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** 判讀某個地點在 now（裝置的當地時間）的營業狀態 */
export function openStatus(hours: string, now: Date): OpenStatus {
  if (!hours.trim()) return { state: 'unknown' }
  const lines = dayLines(hours)
  if (lines.size === 0) return { state: 'unknown' }
  const day = now.getDay()
  const minutes = now.getHours() * 60 + now.getMinutes()

  // 昨天跨夜營業（例如 18:00–02:00）的尾段
  const yesterday = lines.get((day + 6) % 7)
  if (yesterday && !CLOSED_RE.test(yesterday) && !ALL_DAY_RE.test(yesterday)) {
    if (parseRanges(yesterday).some(([, end]) => end > 1440 && minutes < end - 1440)) return { state: 'open' }
  }

  const today = lines.get(day)
  if (today === undefined) return { state: 'unknown' }
  if (ALL_DAY_RE.test(today)) return { state: 'open' }
  const ranges = parseRanges(today)
  if (ranges.length === 0) return { state: CLOSED_RE.test(today) ? 'closed' : 'unknown' }
  if (ranges.some(([s, e]) => minutes >= s && minutes < e)) return { state: 'open' }
  const next = ranges.filter(([s]) => s > minutes).sort((a, b) => a[0] - b[0])[0]
  if (next) return { state: 'later', opensAt: hhmm(next[0]) }
  return { state: 'ended' }
}

export function sortByOpen<T extends Pick<Place, 'id' | 'hours'>>(places: readonly T[], now: Date): { sorted: T[]; statuses: Map<string, OpenStatus> } {
  const statuses = new Map(places.map((p) => [p.id, openStatus(p.hours, now)]))
  const rank = (p: T) => OPEN_RANK[statuses.get(p.id)?.state ?? 'unknown']
  return { sorted: stableSort(places, (a, b) => rank(a) - rank(b)), statuses }
}

/** 公尺 → 顯示用的距離數值與單位 */
export function formatDistance(m: number): { value: string; unit: 'm' | 'km' } {
  if (m < 1000) return { value: String(Math.max(10, Math.round(m / 10) * 10)), unit: 'm' }
  return { value: m < 10_000 ? (m / 1000).toFixed(1) : String(Math.round(m / 1000)), unit: 'km' }
}
