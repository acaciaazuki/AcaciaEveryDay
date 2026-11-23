import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from './schema'
import { settingsSchema } from './schema'
import { dayRhythm, greetingKey, rhythmLength, rhythmTimes } from './today'

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

describe('自訂作息', () => {
  it('沒設定時用預設 07:00–23:00', () => {
    expect(rhythmTimes({})).toEqual({ wake: '07:00', sleep: '23:00' })
    expect(rhythmTimes({ rhythm: { wake: '06:30', sleep: '22:00' } })).toEqual({ wake: '06:30', sleep: '22:00' })
  })
  it('依自訂時間計算', () => {
    expect(dayRhythm([ev('06:00', '07:00')], '06:30', '22:00')).toEqual({ busyMinutes: 30, freeMinutes: 900, totalMinutes: 930 })
  })
  it('就寢在隔天凌晨時，區間延伸到隔天', () => {
    expect(rhythmLength('09:00', '01:00')).toBe(16 * 60)
    const r = dayRhythm([ev('08:00', '10:00'), ev('22:00', '23:59')], '09:00', '01:00')
    expect(r.totalMinutes).toBe(960)
    expect(r.busyMinutes).toBe(60 + 119)
  })
  it('設定格式不對或起床等於就寢時當作沒設定', () => {
    expect(settingsSchema.parse({ rhythm: { wake: '7:00', sleep: '23:00' } }).rhythm).toBeUndefined()
    expect(settingsSchema.parse({ rhythm: { wake: '08:00', sleep: '08:00' } }).rhythm).toBeUndefined()
    expect(settingsSchema.parse({ rhythm: { wake: '06:00', sleep: '00:30' } }).rhythm).toEqual({ wake: '06:00', sleep: '00:30' })
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
