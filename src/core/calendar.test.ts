import { describe, expect, it } from 'vitest'
import { monthCells, shiftMonth, weekdayNames } from './calendar'

describe('calendar', () => {
  it('2026 年 11 月從星期日開始、共 30 天', () => {
    const c = monthCells(2026, 10)
    expect(c[0]).toBe('2026-11-01')
    expect(c.filter(Boolean)).toHaveLength(30)
  })
  it('2026 年 12 月開頭補 2 格（12/1 是星期二）', () => {
    const c = monthCells(2026, 11)
    expect(c.slice(0, 3)).toEqual([null, null, '2026-12-01'])
  })
  it('跨年加減月份', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 })
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 })
  })
  it('星期名稱從星期日開始', () => {
    expect(weekdayNames('zh-TW')[0]).toBe('日')
    expect(weekdayNames('en')[1]).toBe('M')
  })
})
