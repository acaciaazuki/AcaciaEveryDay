import { describe, expect, it } from 'vitest'
import { formatTime, formatTime24, formatTimeRange, formatTimeRange24, from12, isAllDay, parseHourInput, parseMinuteInput, to12 } from './time'

describe('12 小時制換算', () => {
  it.each([
    ['00:00', 12, 0, 'am'],
    ['00:30', 12, 30, 'am'],
    ['09:05', 9, 5, 'am'],
    ['11:59', 11, 59, 'am'],
    ['12:00', 12, 0, 'pm'],
    ['13:15', 1, 15, 'pm'],
    ['21:00', 9, 0, 'pm'],
    ['23:59', 11, 59, 'pm'],
  ] as const)('%s ↔ %d:%d %s', (hhmm, h12, m, period) => {
    expect(to12(hhmm)).toEqual({ h12, m, period })
    expect(from12(h12, m, period)).toBe(hhmm)
  })

  it('格式不對、超出範圍回傳 null', () => {
    for (const s of ['', '24:00', '12:60', 'ab:cd', '9']) expect(to12(s), s).toBeNull()
  })
})

describe('顯示格式', () => {
  it('繁中、英文：09:00 PM；日文：午後 09:00', () => {
    expect(formatTime('21:00', 'zh-TW')).toBe('09:00 PM')
    expect(formatTime('09:30', 'en')).toBe('09:30 AM')
    expect(formatTime('00:00', 'zh-TW')).toBe('12:00 AM')
    expect(formatTime('12:00', 'zh-TW')).toBe('12:00 PM')
    expect(formatTime('21:00', 'ja')).toBe('午後 09:00')
    expect(formatTime('09:00', 'ja')).toBe('午前 09:00')
  })
  it('不顯示「上午／下午」', () => {
    expect(formatTime('21:00', 'zh-TW')).not.toMatch(/上午|下午/)
  })
  it('空字串原樣回傳；起訖只有一邊時只顯示那一邊', () => {
    expect(formatTime('', 'zh-TW')).toBe('')
    expect(formatTimeRange('09:00', '17:30', 'zh-TW')).toBe('09:00 AM–05:30 PM')
    expect(formatTimeRange('09:00', '', 'zh-TW')).toBe('09:00 AM')
  })
})

describe('直接輸入的驗證', () => {
  it('小時 1–12 照目前 AM／PM，0 是 12 AM，13–23 自動換成 PM，24 以上不合法', () => {
    expect(parseHourInput('9', 'am')).toEqual({ h12: 9, period: 'am' })
    expect(parseHourInput('09', 'pm')).toEqual({ h12: 9, period: 'pm' })
    expect(parseHourInput('12', 'am')).toEqual({ h12: 12, period: 'am' })
    expect(parseHourInput('0', 'pm')).toEqual({ h12: 12, period: 'am' })
    expect(parseHourInput('13', 'am')).toEqual({ h12: 1, period: 'pm' })
    expect(parseHourInput('21', 'am')).toEqual({ h12: 9, period: 'pm' })
    for (const s of ['24', '99', '', 'a', '123']) expect(parseHourInput(s, 'am'), s).toBeNull()
  })
  it('分鐘 0–59', () => {
    expect(parseMinuteInput('0')).toBe(0)
    expect(parseMinuteInput('30')).toBe(30)
    expect(parseMinuteInput('59')).toBe(59)
    for (const s of ['60', '75', '', 'x']) expect(parseMinuteInput(s), s).toBeNull()
  })
})

describe('24 小時制顯示（行事曆版面）', () => {
  it('補零並保留 24 小時', () => {
    expect(formatTime24('05:00')).toBe('05:00')
    expect(formatTime24('9:05')).toBe('09:05')
    expect(formatTime24('23:55')).toBe('23:55')
    expect(formatTime24('')).toBe('')
  })
  it('起訖與整天', () => {
    expect(formatTimeRange24('01:00', '23:00')).toBe('01:00–23:00')
    expect(formatTimeRange24('13:00', '')).toBe('13:00')
    expect(formatTimeRange24('', '')).toBe('')
    expect(isAllDay({ start: '', end: '' })).toBe(true)
    expect(isAllDay({ start: '09:00', end: '' })).toBe(false)
  })
})
