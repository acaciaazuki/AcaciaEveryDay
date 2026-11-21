import { toLocalISO } from './date'

/** 某月的格子：開頭用 null 補齊到星期日，之後是每天的 YYYY-MM-DD */
export function monthCells(year: number, month: number): (string | null)[] {
  const offset = new Date(year, month, 1).getDay()
  const days = new Date(year, month + 1, 0).getDate()
  return [...Array<null>(offset).fill(null), ...Array.from({ length: days }, (_, i) => toLocalISO(new Date(year, month, i + 1)))]
}

/** 加減月份，自動跨年 */
export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

/** 依語系產生星期日到星期六的短名稱 */
export function weekdayNames(lng: string | undefined) {
  const f = new Intl.DateTimeFormat(lng, { weekday: 'narrow' })
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(2026, 1, i + 1))) // 2026-02-01 是星期日
}

export const monthLabel = (year: number, month: number, lng: string | undefined) =>
  new Intl.DateTimeFormat(lng, { year: 'numeric', month: 'long' }).format(new Date(year, month, 1))
