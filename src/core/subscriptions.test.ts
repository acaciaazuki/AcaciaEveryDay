import { describe, expect, it } from 'vitest'
import type { Subscription } from './schema'
import { addMonths, chargeDates, daysBetween, monthTotals, nextCharge, sampleSubscriptions, upcoming, yearlyTotals } from './subscriptions'

const sub = (p: Partial<Subscription>): Subscription => ({
  id: p.name ?? 'x',
  name: 'x',
  plan: '',
  cat: 'tools',
  cycle: 'monthly',
  amount: 100,
  currency: 'TWD',
  nextDate: '2026-11-25',
  payment: '',
  status: 'active',
  note: '',
  ...p,
})

describe('addMonths', () => {
  it('超過月底時取該月最後一天，且不會累積偏移', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15')
    expect(addMonths('2026-03-10', -4)).toBe('2025-11-10')
  })
})

describe('daysBetween', () => {
  it('跨月跨年', () => {
    expect(daysBetween('2026-11-22', '2026-11-22')).toBe(0)
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3)
  })
})

describe('chargeDates / nextCharge', () => {
  it('列出區間內所有扣款日（含往前推算的日期）', () => {
    expect(chargeDates(sub({ nextDate: '2026-12-05' }), '2026-09-01', '2026-12-31')).toEqual(['2026-09-05', '2026-10-05', '2026-11-05', '2026-12-05'])
    expect(chargeDates(sub({ nextDate: '2026-03-01', cycle: 'quarterly' }), '2026-01-01', '2026-12-31')).toEqual(['2026-03-01', '2026-06-01', '2026-09-01', '2026-12-01'])
    expect(chargeDates(sub({ nextDate: '' }), '2026-01-01', '2026-12-31')).toEqual([])
  })
  it('儲存的扣款日過了，自動推到下一期', () => {
    expect(nextCharge(sub({ nextDate: '2026-10-31' }), '2026-11-22')).toBe('2026-11-30')
    expect(nextCharge(sub({ nextDate: '2025-12-01', cycle: 'yearly' }), '2026-11-22')).toBe('2026-12-01')
    expect(nextCharge(sub({ nextDate: '2026-11-22' }), '2026-11-22')).toBe('2026-11-22')
    expect(nextCharge(sub({ nextDate: '2027-02-01' }), '2026-11-22')).toBe('2027-02-01')
  })
})

describe('統計', () => {
  const today = '2026-11-22'
  const list = [
    sub({ name: 'a', amount: 300, nextDate: '2026-11-05' }), // 本月已扣過
    sub({ name: 'b', amount: 20, currency: 'USD', nextDate: '2026-11-28' }),
    sub({ name: 'c', amount: 1200, cycle: 'yearly', nextDate: '2027-03-01' }), // 本月不扣
    sub({ name: 'd', amount: 600, cycle: 'quarterly', nextDate: '2026-12-10' }),
    sub({ name: 'e', amount: 999, status: 'paused', nextDate: '2026-11-23' }),
  ]

  it('本月支出依幣別分開，TWD 在前，只算使用中', () => {
    expect(monthTotals(list, today)).toEqual([
      ['TWD', 300],
      ['USD', 20],
    ])
  })
  it('年度預估：月 × 12、季 × 4、年 × 1', () => {
    expect(yearlyTotals(list)).toEqual([
      ['TWD', 300 * 12 + 1200 + 600 * 4],
      ['USD', 240],
    ])
  })
  it('即將扣款依日期排序，含倒數天數', () => {
    expect(upcoming(list, today, 7).map((x) => [x.sub.name, x.daysLeft])).toEqual([['b', 6]])
    expect(upcoming(list, today, 30).map((x) => [x.sub.name, x.date])).toEqual([
      ['b', '2026-11-28'],
      ['d', '2026-12-10'],
      ['a', '2026-12-05'],
    ].sort((x, y) => x[1]!.localeCompare(y[1]!)))
  })
  it('範例資料有 3 筆，扣款日都在 30 天內', () => {
    const s = sampleSubscriptions(today, '信用卡')
    expect(s).toHaveLength(3)
    expect(upcoming(s.map((x, i) => ({ id: String(i), ...x })), today, 30)).toHaveLength(3)
  })
})
