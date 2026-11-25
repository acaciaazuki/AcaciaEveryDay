import { describe, expect, it } from 'vitest'
import { addDays, buildIcs, escapeText, foldLine, type IcsEvent } from './ics'

const NOW = new Date(Date.UTC(2026, 10, 25, 3, 4, 5))
const ev = (patch: Partial<IcsEvent> = {}): IcsEvent => ({ uid: 'e1@personal.acacia-everyday', title: '牙醫', dateISO: '2026-11-25', start: '14:00', end: '15:00', ...patch })
/** 取出單一行程的內容行（先把折行接回來） */
const lines = (ics: string) => ics.replace(/\r\n /g, '').split('\r\n')

describe('.ics 匯出', () => {
  it('標準結構：VCALENDAR／VEVENT、CRLF 換行、行事曆名稱、DTSTAMP 是 UTC', () => {
    const ics = buildIcs([ev()], { calendarName: 'ACACIA', now: NOW })
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).not.toMatch(/[^\r]\n/)
    const l = lines(ics)
    expect(l).toEqual(expect.arrayContaining(['X-WR-CALNAME:ACACIA', 'BEGIN:VEVENT', 'UID:e1@personal.acacia-everyday', 'DTSTAMP:20261125T030405Z', 'DTSTART:20261125T140000', 'DTEND:20261125T150000', 'SUMMARY:牙醫', 'END:VEVENT']))
  })

  it('整天行程：VALUE=DATE，結束日是隔天（不含）；跨日整天到最後一天的隔天', () => {
    const l = lines(buildIcs([ev({ start: '', end: '' }), ev({ uid: 'e2', start: '', end: '', endDateISO: '2026-11-27' })], { calendarName: 'x', now: NOW }))
    expect(l).toEqual(expect.arrayContaining(['DTSTART;VALUE=DATE:20261125', 'DTEND;VALUE=DATE:20261126', 'DTEND;VALUE=DATE:20261128']))
  })

  it('跨過午夜、沒有結束時間、跨月跨年的日期計算', () => {
    const l = lines(buildIcs([ev({ start: '22:00', end: '02:00' }), ev({ uid: 'e2', start: '23:30', end: '' })], { calendarName: 'x', now: NOW }))
    expect(l).toEqual(expect.arrayContaining(['DTEND:20261126T020000', 'DTSTART:20261125T233000', 'DTEND:20261126T003000']))
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('文字跳脫：反斜線、分號、逗號、換行；地點、備註、分類', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne')
    const l = lines(buildIcs([ev({ title: '會議;A,B', location: '台中', note: '第一行\n第二行', category: '陳家' })], { calendarName: 'x', now: NOW }))
    expect(l).toEqual(expect.arrayContaining(['SUMMARY:會議\\;A\\,B', 'LOCATION:台中', 'DESCRIPTION:第一行\\n第二行', 'CATEGORIES:陳家']))
  })

  it('折行：每行不超過 75 個位元組，中文字不會被切斷，接回去內容不變', () => {
    const long = `SUMMARY:${'相思樹'.repeat(40)}`
    const folded = foldLine(long)
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    expect(folded.replace(/\r\n /g, '')).toBe(long)
  })
})
