import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from './schema'
import { dayRhythm, greetingKey } from './today'

const ev = (start: string, end: string): CalendarEvent => ({ id: start, title: '', dateISO: '2026-11-21', start, end, note: '' })

describe('dayRhythm', () => {
  it('沒有行程時整段作息都是空檔', () => {
    expect(dayRhythm([])).toEqual({ busyMinutes: 0, freeMinutes: 960, totalMinutes: 960 })
  })
  it('重疊的行程只算一次，超出作息的部分不算', () => {
    const r = dayRhythm([ev('06:00', '08:00'), ev('12:00', '13:30'), ev('13:00', '14:00'), ev('22:30', '23:59')])
    expect(r.busyMinutes).toBe(60 + 120 + 30)
  })
  it('忽略沒有時間或結束早於開始的行程', () => {
    expect(dayRhythm([ev('', ''), ev('10:00', '09:00')]).busyMinutes).toBe(0)
  })
})

describe('greetingKey', () => {
  it('依時段給問候', () => {
    expect(greetingKey(8)).toBe('morning')
    expect(greetingKey(14)).toBe('afternoon')
    expect(greetingKey(19)).toBe('evening')
    expect(greetingKey(2)).toBe('night')
  })
})
