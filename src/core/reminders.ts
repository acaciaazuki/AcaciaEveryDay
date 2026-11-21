import type { Reminder } from './schema'

export interface LatLng {
  lat: number
  lng: number
}

/** 一次定位結果。accuracy 是誤差半徑（公尺） */
export interface Fix extends LatLng {
  accuracy: number
}

const RAD = Math.PI / 180

/** 兩個座標的距離（公尺），球面公式 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD
  const dLng = (b.lng - a.lng) * RAD
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)))
}

const valid = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180

/**
 * 從文字抓座標。支援直接貼 Google 地圖複製的「25.0330, 121.5654」，
 * 或含 @緯度,經度、!3d緯度!4d經度、q=緯度,經度 的地圖連結。
 */
export function parseCoords(input: string): LatLng | null {
  const text = input.trim()
  if (!text) return null
  const patterns = [/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/, /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, /[?&](?:q|ll|query)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/, /^\(?\s*(-?\d+(?:\.\d+)?)\s*[,，\s]\s*(-?\d+(?:\.\d+)?)\s*\)?$/]
  for (const re of patterns) {
    const m = re.exec(text)
    if (m && valid(Number(m[1]), Number(m[2]))) return { lat: Number(m[1]), lng: Number(m[2]) }
  }
  return null
}

export const hasCoords = (r: Pick<Reminder, 'lat' | 'lng'>): r is { lat: number; lng: number } => typeof r.lat === 'number' && typeof r.lng === 'number'

/** 星期是否符合。getDay()：0 日、6 六 */
export function isDayActive(r: Pick<Reminder, 'days' | 'customDays'>, day: number): boolean {
  switch (r.days) {
    case 'every':
      return true
    case 'weekdays':
      return day >= 1 && day <= 5
    case 'weekends':
      return day === 0 || day === 6
    case 'custom':
      return r.customDays.includes(day)
  }
}

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** 時段是否符合：兩個都沒填＝整天；只填一邊就只限制那一邊；起點晚於終點代表跨午夜 */
export function isTimeActive(r: Pick<Reminder, 'start' | 'end'>, minutesOfDay: number): boolean {
  if (!r.start && !r.end) return true
  if (r.start && !r.end) return minutesOfDay >= toMin(r.start)
  if (!r.start && r.end) return minutesOfDay <= toMin(r.end)
  const a = toMin(r.start)
  const b = toMin(r.end)
  return a <= b ? minutesOfDay >= a && minutesOfDay <= b : minutesOfDay >= a || minutesOfDay <= b
}

export function isActiveNow(r: Reminder, now: Date): boolean {
  return r.enabled && isDayActive(r, now.getDay()) && isTimeActive(r, now.getHours() * 60 + now.getMinutes())
}

/** 把「錢包、鑰匙，卡片」這類輸入拆成一個個物品，去掉空白與重複 */
export function splitItems(input: string, existing: string[] = []): string[] {
  const seen = new Set(existing)
  const out: string[] = []
  for (const raw of input.split(/[、,，;；\n]/)) {
    const s = raw.trim()
    if (s && !seen.has(s)) {
      seen.add(s)
      out.push(s)
    }
  }
  return out
}

export interface FireEvent {
  reminder: Reminder
  kind: 'arrive' | 'leave'
}

/** 同一條規則兩次通知之間至少間隔（毫秒），避免 GPS 在邊界抖動時洗版 */
export const COOLDOWN_MS = 10 * 60 * 1000

/**
 * 進出偵測。每次定位更新呼叫 update，回傳這次要通知的事件。
 * - 第一次定位只記錄目前在範圍內或外，不通知（打開網頁時人已經在裡面，不算「抵達」）
 * - 離開要超出半徑一小段（遲滯）才算，避免在邊界來回跳
 * - 定位誤差比半徑大太多的結果直接忽略
 * - 只有符合星期、時段，且距離上次通知超過冷卻時間才通知；範圍外→內只會通知一次，必須先離開再回來才會再次通知
 */
export function createTracker() {
  const inside = new Map<string, boolean>()
  const lastFired = new Map<string, number>()
  const keyOf = (r: Reminder) => `${r.id}|${r.lat},${r.lng}|${r.radius}`

  return {
    update(reminders: Reminder[], fix: Fix, now: Date): FireEvent[] {
      const events: FireEvent[] = []
      const live = new Set<string>()
      for (const r of reminders) {
        if (!r.enabled || !hasCoords(r)) continue
        const key = keyOf(r)
        live.add(key)
        if (fix.accuracy > r.radius * 1.5) continue
        const d = distanceMeters(fix, r)
        const was = inside.get(key)
        const margin = Math.max(10, r.radius * 0.15)
        let kind: FireEvent['kind'] | null = null
        if (was === undefined) inside.set(key, d <= r.radius)
        else if (!was && d <= r.radius) {
          inside.set(key, true)
          kind = 'arrive'
        } else if (was && d > r.radius + margin) {
          inside.set(key, false)
          kind = 'leave'
        }
        if (kind !== r.trigger || !isActiveNow(r, now)) continue
        const last = lastFired.get(key)
        if (last !== undefined && now.getTime() - last < COOLDOWN_MS) continue
        lastFired.set(key, now.getTime())
        events.push({ reminder: r, kind })
      }
      // 已刪除、停用或改過座標的規則，狀態一併清掉
      for (const k of [...inside.keys()]) if (!live.has(k)) inside.delete(k)
      for (const k of [...lastFired.keys()]) if (!live.has(k)) lastFired.delete(k)
      return events
    },
  }
}
