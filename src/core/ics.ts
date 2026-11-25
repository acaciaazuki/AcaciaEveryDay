import type { CalendarEvent } from './schema'

/**
 * 匯出標準 iCalendar（.ics，RFC 5545）：其他行事曆 App（Apple 行事曆、Google 日曆、Outlook…）都能匯入。
 * 純函式、不連網；匯出我的行事曆（personalIcsEvents）。
 *
 * - 有時間的行程用「浮動時間」（不帶時區，匯入後照當地時間顯示，跟 App 裡看到的一樣）
 * - 整天行程用 VALUE=DATE，結束日依規範是「隔天」（不含）
 * - 結束時間比開始早：視為跨過午夜，結束在隔天
 * - 沒有結束時間：當作 1 小時
 * - 換行用 CRLF，每行超過 75 個位元組就折行（UTF-8 不會切在字的中間）
 */
export interface IcsEvent {
  /** 穩定的識別碼：再次匯入時，行事曆 App 會更新同一筆而不是重複新增 */
  uid: string
  title: string
  dateISO: string
  /** 跨日行程的最後一天；空字串或省略表示同一天 */
  endDateISO?: string
  /** HH:mm；空字串表示整天 */
  start: string
  end: string
  location?: string
  note?: string
  /** 分類，匯入後有些 App 會顯示 */
  category?: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (iso: string) => iso.replaceAll('-', '')
const hms = (hhmm: string) => `${hhmm.replace(':', '')}00`

/** ISO 日期加減天數（用 UTC 計算，不受夏令時間影響） */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** 文字欄位的跳脫：反斜線、分號、逗號、換行 */
export const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** 折行：每行最多 75 個位元組，續行以一個空白開頭 */
export function foldLine(line: string): string {
  const enc = new TextEncoder()
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    const limit = out.length === 0 ? 75 : 74 // 續行的開頭空白也算一個位元組
    if (bytes + n > limit) {
      out.push(cur)
      cur = ''
      bytes = 0
    }
    cur += ch
    bytes += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

const stampOf = (now: Date) =>
  `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`

/** 有時間的行程沒有結束時間：預設 1 小時（跨過午夜時落在隔天） */
function plusOneHour(dateISO: string, start: string): { date: string; time: string } {
  const [h, m] = start.split(':').map(Number) as [number, number]
  return h >= 23 ? { date: addDays(dateISO, 1), time: `${pad(h - 23)}:${pad(m)}` } : { date: dateISO, time: `${pad(h + 1)}:${pad(m)}` }
}

function eventLines(e: IcsEvent, stamp: string): string[] {
  const lastDay = e.endDateISO || e.dateISO
  const lines = ['BEGIN:VEVENT', `UID:${escapeText(e.uid)}`, `DTSTAMP:${stamp}`]
  if (!e.start) {
    lines.push(`DTSTART;VALUE=DATE:${ymd(e.dateISO)}`, `DTEND;VALUE=DATE:${ymd(addDays(lastDay, 1))}`)
  } else {
    let endDate = lastDay
    let endTime = e.end
    if (!endTime) ({ date: endDate, time: endTime } = plusOneHour(lastDay, e.start))
    else if (lastDay === e.dateISO && endTime < e.start) endDate = addDays(lastDay, 1)
    lines.push(`DTSTART:${ymd(e.dateISO)}T${hms(e.start)}`, `DTEND:${ymd(endDate)}T${hms(endTime)}`)
  }
  lines.push(`SUMMARY:${escapeText(e.title)}`)
  if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`)
  if (e.note) lines.push(`DESCRIPTION:${escapeText(e.note)}`)
  if (e.category) lines.push(`CATEGORIES:${escapeText(e.category)}`)
  lines.push('END:VEVENT')
  return lines
}

/** 產生整份 .ics 文字 */
export function buildIcs(events: readonly IcsEvent[], options: { calendarName: string; now?: Date }): string {
  const stamp = stampOf(options.now ?? new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ACACIA Everyday//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(options.calendarName)}`,
    ...events.flatMap((e) => eventLines(e, stamp)),
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/** 匯出檔名：acacia-calendar-YYYY-MM-DD.ics */
export const icsFileName = (now = new Date()) => `acacia-calendar-${now.toISOString().slice(0, 10)}.ics`

/** 我的行事曆（不含「最近刪除」）轉成 .ics 行程 */
export const personalIcsEvents = (events: readonly CalendarEvent[]): IcsEvent[] =>
  events
    .filter((e) => e.deletedAt === undefined && e.dateISO)
    .map((e) => ({ uid: `${e.id}@personal.acacia-everyday`, title: e.title, dateISO: e.dateISO, endDateISO: e.endDateISO ?? '', start: e.start, end: e.end, note: e.note }))
    .sort((a, b) => (a.dateISO + a.start).localeCompare(b.dateISO + b.start))
