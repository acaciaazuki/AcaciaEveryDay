import { addDays } from './date'
import { formatTime, formatTimeRange } from './time'

/**
 * 跨日與跨午夜的行程（個人行程與共享行程共用）。
 *
 * 資料：dateISO 是開始日、endDateISO 是結束日（空字串或沒有表示同一天）；
 * start 是開始日的開始時間、end 是結束日的結束時間；兩個都空是整天。
 * 例如大夜班 12/10 22:30 → 12/11 02:00 存成 dateISO 12/10、endDateISO 12/11、start 22:30、end 02:00。
 *
 * 畫面上每一天顯示「這一天的那一段」（DaySpan）：
 * - single：同一天的行程，時間照原樣
 * - start：第一天，從開始時間到午夜
 * - middle：中間的日子，整天
 * - end：最後一天，從午夜到結束時間
 */
export type SpanPos = 'single' | 'start' | 'middle' | 'end'
export interface DaySpan {
  pos: SpanPos
  /** 這一天這段的開始／結束時間；空字串表示從午夜開始或到午夜結束（整天行程兩個都空） */
  start: string
  end: string
  /** 整個行程是整天行程（沒有時間） */
  allDay: boolean
}

export interface Spanning {
  dateISO: string
  endDateISO?: string
  start: string
  end: string
}

/** 最後一天：結束日比開始日晚才算跨日 */
export const lastDayOf = (x: Pick<Spanning, 'dateISO' | 'endDateISO'>) => (x.endDateISO && x.endDateISO > x.dateISO ? x.endDateISO : x.dateISO)

export const isMultiDay = (x: Pick<Spanning, 'dateISO' | 'endDateISO'>) => lastDayOf(x) !== x.dateISO

/** 這個行程有沒有涵蓋某一天 */
export const coversDay = (x: Pick<Spanning, 'dateISO' | 'endDateISO'>, iso: string) => x.dateISO <= iso && iso <= lastDayOf(x)

/** 某一天要顯示的那一段 */
export function spanOn(x: Spanning, iso: string): DaySpan {
  const allDay = !x.start && !x.end
  const last = lastDayOf(x)
  if (last === x.dateISO) return { pos: 'single', start: x.start, end: x.end, allDay }
  if (iso <= x.dateISO) return { pos: 'start', start: x.start, end: '', allDay }
  if (iso >= last) return { pos: 'end', start: '', end: x.end, allDay }
  return { pos: 'middle', start: '', end: '', allDay }
}

/**
 * 這一段實際佔用的時間（給「今天的節奏」計算佔用時數）：從午夜開始是 00:00、到午夜是 24:00。
 * 整天行程回傳 null（跟原本一樣不算進時數）。
 */
export function busyTimesOn(x: Spanning, iso: string): { start: string; end: string } | null {
  const s = spanOn(x, iso)
  if (s.allDay) return null
  if (s.pos === 'single') return { start: s.start, end: s.end }
  return { start: s.start || '00:00', end: s.end || '24:00' }
}

/**
 * 這一段的時間文字（月曆標籤、清單）：
 * single「09:00–10:00」；start「22:30 →」；end「→ 02:00」；middle 與整天回傳空字串（由畫面顯示「整天」或只顯示標題）。
 */
export function spanTimeText(s: DaySpan): string {
  if (s.allDay) return ''
  if (s.pos === 'single') return formatTimeRange(s.start, s.end)
  if (s.pos === 'start') return s.start ? `${formatTime(s.start)} →` : ''
  if (s.pos === 'end') return s.end ? `→ ${formatTime(s.end)}` : ''
  return ''
}

/** 完整的起訖文字（詳細資料、清單第二行）：跨日時「12/10 22:30 – 12/11 02:00」；同一天就是時間區間 */
export function rangeText(x: Spanning, md: (iso: string) => string): string {
  if (!isMultiDay(x)) return formatTimeRange(x.start, x.end)
  const from = [md(x.dateISO), x.start && formatTime(x.start)].filter(Boolean).join(' ')
  const to = [md(lastDayOf(x)), x.end && formatTime(x.end)].filter(Boolean).join(' ')
  return `${from} – ${to}`
}

// ---------- 行程表單 ----------

/** 開始日期改了：結束日期跟著平移，保持原本的天數（同一天的行程仍是同一天） */
export function shiftEndDate(oldStart: string, newStart: string, endDateISO: string): string {
  if (!endDateISO || endDateISO <= oldStart || !oldStart || !newStart) return ''
  const days = Math.round((Date.parse(`${endDateISO}T00:00Z`) - Date.parse(`${oldStart}T00:00Z`)) / 86_400_000)
  return addDays(newStart, days)
}

export type EndCheck =
  /** 可以儲存；endDateISO 是要存的值（同一天存空字串），overnight 表示自動推到隔天 */
  | { ok: true; endDateISO: string; overnight: boolean }
  | { ok: false; error: 'endBeforeStart' }

/**
 * 儲存前檢查結束日期與時間：
 * - 結束日期早於開始日期：不能存
 * - 同一天、結束時間早於開始時間（例如 22:30～02:00）：視為跨過午夜，結束日期自動改成隔天
 * - 跨日的行程：只要「結束日期＋時間」晚於「開始日期＋時間」就可以
 * - 同一天、結束時間等於開始時間：不能存（長度是零）
 */
export function checkEnd(x: { dateISO: string; endDateISO: string; start: string; end: string }): EndCheck {
  const endDate = x.endDateISO || x.dateISO
  if (endDate < x.dateISO) return { ok: false, error: 'endBeforeStart' }
  const allDay = !x.start && !x.end
  if (allDay || !x.start || !x.end) return { ok: true, endDateISO: endDate > x.dateISO ? endDate : '', overnight: false }
  if (endDate === x.dateISO) {
    if (x.end > x.start) return { ok: true, endDateISO: '', overnight: false }
    if (x.end < x.start) return { ok: true, endDateISO: addDays(x.dateISO, 1), overnight: true }
    return { ok: false, error: 'endBeforeStart' }
  }
  return { ok: true, endDateISO: endDate, overnight: false }
}
