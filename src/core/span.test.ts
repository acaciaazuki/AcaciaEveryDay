import { describe, expect, it } from 'vitest'
import { busyConflicts, type SharedEntry } from './calendarView'
import { buildIcs } from './ics'
import { agendaOn } from './shoppingAgenda'
import { busyTimesOn, checkEnd, coversDay, rangeText, shiftEndDate, spanOn, spanTimeText } from './span'
import { busyTimesOnDay, dayRhythm } from './today'
import type { CalendarEvent } from './schema'

const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8))}`
/** 大夜班：12/10 22:30 → 12/11 02:00 */
const night = { dateISO: '2026-12-10', endDateISO: '2026-12-11', start: '22:30', end: '02:00' }
/** 家庭旅遊：12/20–12/22 整天 */
const trip = { dateISO: '2026-12-20', endDateISO: '2026-12-22', start: '', end: '' }
const ev = (id: string, x: Partial<CalendarEvent>): CalendarEvent => ({ id, title: id, dateISO: '2026-12-10', start: '', end: '', note: '', ...x })

describe('跨日與跨午夜：每一天顯示的那一段', () => {
  it('跨午夜：第一天從開始到午夜、隔天從午夜到結束', () => {
    expect(spanOn(night, '2026-12-10')).toEqual({ pos: 'start', start: '22:30', end: '', allDay: false })
    expect(spanOn(night, '2026-12-11')).toEqual({ pos: 'end', start: '', end: '02:00', allDay: false })
    expect(spanTimeText(spanOn(night, '2026-12-10'))).toBe('22:30 →')
    expect(spanTimeText(spanOn(night, '2026-12-11'))).toBe('→ 02:00')
    expect(rangeText(night, md)).toBe('12/10 22:30 – 12/11 02:00')
  })

  it('連續跨日（整天）：每一天都涵蓋，中間的日子是 middle', () => {
    expect(['2026-12-19', '2026-12-20', '2026-12-21', '2026-12-22', '2026-12-23'].map((d) => coversDay(trip, d))).toEqual([false, true, true, true, false])
    expect(['2026-12-20', '2026-12-21', '2026-12-22'].map((d) => spanOn(trip, d).pos)).toEqual(['start', 'middle', 'end'])
    expect(spanTimeText(spanOn(trip, '2026-12-21'))).toBe('')
    expect(rangeText(trip, md)).toBe('12/20 – 12/22')
  })

  it('同一天的行程跟原本一樣；結束日不晚於開始日視為同一天', () => {
    const one = { dateISO: '2026-12-10', endDateISO: '', start: '09:00', end: '10:00' }
    expect(spanOn(one, '2026-12-10')).toEqual({ pos: 'single', start: '09:00', end: '10:00', allDay: false })
    expect(spanOn({ ...one, endDateISO: '2026-12-09' }, '2026-12-10').pos).toBe('single')
    expect(rangeText(one, md)).toBe('09:00–10:00')
  })

  it('節奏的佔用時段：第一天算到 24:00、最後一天從 00:00、整天行程不算', () => {
    expect(busyTimesOn(night, '2026-12-10')).toEqual({ start: '22:30', end: '24:00' })
    expect(busyTimesOn(night, '2026-12-11')).toEqual({ start: '00:00', end: '02:00' })
    expect(busyTimesOn(trip, '2026-12-21')).toBeNull()
    // 作息 07:00–23:00：12/10 只算 22:30–23:00 半小時，隔天凌晨不在作息內
    expect(dayRhythm(busyTimesOnDay([night], '2026-12-10')).busyMinutes).toBe(30)
    expect(dayRhythm(busyTimesOnDay([night], '2026-12-11')).busyMinutes).toBe(0)
  })
})

describe('行程表單：結束日期與跨午夜', () => {
  it('同一天、結束時間早於開始時間：自動跨到隔天，不擋下', () => {
    expect(checkEnd({ dateISO: '2026-12-10', endDateISO: '', start: '22:30', end: '02:00' })).toEqual({ ok: true, endDateISO: '2026-12-11', overnight: true })
    // 月底、年底也正確
    expect(checkEnd({ dateISO: '2026-12-31', endDateISO: '2026-12-31', start: '23:00', end: '01:00' })).toMatchObject({ endDateISO: '2027-01-01' })
  })

  it('只有「結束日期＋時間」整體早於開始才擋下；長度為零也擋下', () => {
    expect(checkEnd({ dateISO: '2026-12-10', endDateISO: '2026-12-09', start: '09:00', end: '10:00' })).toEqual({ ok: false, error: 'endBeforeStart' })
    expect(checkEnd({ dateISO: '2026-12-10', endDateISO: '', start: '09:00', end: '09:00' })).toEqual({ ok: false, error: 'endBeforeStart' })
    // 跨日：結束時間比開始早也可以（不同天）
    expect(checkEnd({ dateISO: '2026-12-10', endDateISO: '2026-12-12', start: '18:00', end: '09:00' })).toEqual({ ok: true, endDateISO: '2026-12-12', overnight: false })
  })

  it('整天行程：可以跨日；結束日等於開始日存空字串；結束日較早擋下', () => {
    expect(checkEnd({ dateISO: '2026-12-20', endDateISO: '2026-12-22', start: '', end: '' })).toEqual({ ok: true, endDateISO: '2026-12-22', overnight: false })
    expect(checkEnd({ dateISO: '2026-12-20', endDateISO: '2026-12-20', start: '', end: '' })).toEqual({ ok: true, endDateISO: '', overnight: false })
    expect(checkEnd({ dateISO: '2026-12-20', endDateISO: '2026-12-19', start: '', end: '' }).ok).toBe(false)
  })

  it('開始日期改了：結束日期跟著平移、保持天數；同一天的行程維持同一天', () => {
    expect(shiftEndDate('2026-12-20', '2026-12-25', '2026-12-22')).toBe('2026-12-27')
    expect(shiftEndDate('2026-12-30', '2027-01-02', '2026-12-31')).toBe('2027-01-03')
    expect(shiftEndDate('2026-12-20', '2026-12-25', '')).toBe('')
  })
})

describe('畫面與匯出', () => {
  it('每日清單：跨日的個人行程出現在涵蓋的每一天，排在最前面，帶著這一天那一段', () => {
    const events = [ev('早會', { dateISO: '2026-12-11', start: '08:00', end: '09:00' }), ev('大夜班', night)]
    const day1 = agendaOn(events, new Map(), '2026-12-10')
    const day2 = agendaOn(events, new Map(), '2026-12-11')
    expect(day1.map((i) => i.id)).toEqual(['大夜班'])
    expect(day2.map((i) => i.id)).toEqual(['大夜班', '早會'])
    expect(day2[0]).toMatchObject({ start: '', span: { pos: 'end', end: '02:00' } })
    expect(agendaOn(events, new Map(), '2026-12-12')).toEqual([])
  })

  it('重疊提醒：跨午夜的忙碌區塊只比對這一天那一段；自己的行程跨午夜算到午夜', () => {
    const block = { id: 'b', dateISO: night.dateISO, lastDateISO: night.endDateISO, start: night.start, end: night.end, projected: true, access: 'busy' } as SharedEntry
    // 12/11 早上 08:00 的行程不跟凌晨的大夜班重疊；01:00 會
    expect(busyConflicts([block], '2026-12-11', '08:00', '09:00')).toEqual([])
    expect(busyConflicts([block], '2026-12-11', '01:00', '03:00')).toEqual([block])
    // 12/10 白天不重疊；自己 23:00～01:00（跨午夜）會
    expect(busyConflicts([block], '2026-12-10', '09:00', '10:00')).toEqual([])
    expect(busyConflicts([block], '2026-12-10', '23:00', '01:00')).toEqual([block])
  })

  it('.ics：跨午夜與連續跨日的起訖正確', () => {
    const ics = buildIcs(
      [
        { uid: 'n', title: '大夜班', ...night },
        { uid: 't', title: '家庭旅遊', ...trip },
      ],
      { calendarName: 'x', now: new Date(0) },
    )
    expect(ics).toContain('DTSTART:20261210T223000\r\nDTEND:20261211T020000')
    expect(ics).toContain('DTSTART;VALUE=DATE:20261220\r\nDTEND;VALUE=DATE:20261223')
  })
})
