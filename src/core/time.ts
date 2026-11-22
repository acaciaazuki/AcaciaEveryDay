/**
 * 時間顯示與 12 小時制換算。資料一律存 24 小時制的 "HH:mm"（例如 "21:00"），只有畫面顯示改成 AM／PM。
 * 繁中、英文顯示「09:00 PM」；日文照日本習慣顯示「午後 09:00」。
 */
export type Period = 'am' | 'pm'

/** "HH:mm" → 小時、分鐘；格式不對就回傳 null */
export function parseHHMM(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  return h <= 23 && min <= 59 ? { h, m: min } : null
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 24 小時制 → 12 小時制：0 點是 12 AM、12 點是 12 PM */
export function to12(hhmm: string): { h12: number; m: number; period: Period } | null {
  const p = parseHHMM(hhmm)
  if (!p) return null
  return { h12: p.h % 12 || 12, m: p.m, period: p.h < 12 ? 'am' : 'pm' }
}

/** 12 小時制 → "HH:mm"：12 AM 是 00 點、12 PM 是 12 點 */
export const from12 = (h12: number, m: number, period: Period) => `${pad((h12 % 12) + (period === 'pm' ? 12 : 0))}:${pad(m)}`

const isJa = (lng?: string) => !!lng && lng.startsWith('ja')

/** AM／PM 的文字：日文用午前／午後，其他語言用 AM／PM */
export const periodLabel = (period: Period, lng?: string) => (isJa(lng) ? (period === 'am' ? '午前' : '午後') : period.toUpperCase())

/** 日文把午前／午後放在前面 */
export const periodFirst = (lng?: string) => isJa(lng)

/** 拆成時間與上下午，給時間軸這種要分兩行顯示的地方用 */
export function timeParts(hhmm: string, lng?: string): { time: string; period: string } | null {
  const t = to12(hhmm)
  return t ? { time: `${pad(t.h12)}:${pad(t.m)}`, period: periodLabel(t.period, lng) } : null
}

/** "21:00" → 「09:00 PM」（日文「午後 09:00」）；空字串或格式不對就原樣回傳 */
export function formatTime(hhmm: string, lng?: string): string {
  const p = timeParts(hhmm, lng)
  if (!p) return hhmm
  return periodFirst(lng) ? `${p.period} ${p.time}` : `${p.time} ${p.period}`
}

/** 起訖時間：「09:00 AM–10:30 AM」，只有其中一個時就只顯示那個 */
export function formatTimeRange(start: string, end: string, lng?: string): string {
  return [start, end].filter(Boolean).map((x) => formatTime(x, lng)).join('–')
}

/**
 * 小時輸入格的內容 → 12 小時制的小時與（可能要切換的）上下午。
 * 1–12 照目前的 AM／PM；0 視為 12 AM；13–23 當成 24 小時制自動換成 PM（例如打 21 → 09 PM）；其他（24 以上、非數字）回傳 null。
 */
export function parseHourInput(text: string, period: Period): { h12: number; period: Period } | null {
  if (!/^\d{1,2}$/.test(text)) return null
  const n = Number(text)
  if (n >= 1 && n <= 12) return { h12: n, period }
  if (n === 0) return { h12: 12, period: 'am' }
  if (n <= 23) return { h12: n - 12, period: 'pm' }
  return null
}

/** 分鐘輸入格的內容 → 0–59，超出範圍或非數字回傳 null */
export function parseMinuteInput(text: string): number | null {
  if (!/^\d{1,2}$/.test(text)) return null
  const n = Number(text)
  return n <= 59 ? n : null
}

/** 時間戳記顯示成「11月22日 週日 09:30 PM」，時間沿用全站的 AM／PM 格式（備份清單等用） */
export function formatStamp(ts: number, lng?: string): string {
  const d = new Date(ts)
  const date = new Intl.DateTimeFormat(lng, { month: 'short', day: 'numeric', weekday: 'short' }).format(d)
  return `${date} ${formatTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`, lng)}`
}
