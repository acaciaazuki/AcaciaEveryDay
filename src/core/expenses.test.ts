import { describe, expect, it } from 'vitest'
import { billingPeriod, summarize } from './expenses'
import type { Expense } from './schema'

const e = (date: string, amt: number, cat: Expense['cat'] = 'food', customCat?: string): Expense => ({
  id: date + amt, title: 'x', amt, store: '', cat, customCat, date, time: '', done: false,
})

describe('billingPeriod', () => {
  it('10 日以後屬於本月 10 日到次月 9 日', () => {
    expect(billingPeriod(new Date(2026, 10, 21))).toEqual({ start: '2026-11-10', end: '2026-12-09' })
  })
  it('10 日以前屬於上個週期，跨年也正確', () => {
    expect(billingPeriod(new Date(2026, 0, 5))).toEqual({ start: '2025-12-10', end: '2026-01-09' })
  })
})

describe('summarize', () => {
  it('只計算週期內的金額，並依類別加總排序', () => {
    const p = { start: '2026-11-10', end: '2026-12-09' }
    const r = summarize([e('2026-11-10', 100), e('2026-12-09', 50, 'transport'), e('2026-11-09', 999), e('2026-11-20', 300, 'other', '寵物'), e('', 5)], p)
    expect(r.total).toBe(450)
    expect(r.byCategory).toEqual([['custom:寵物', 300], ['food', 100], ['transport', 50]])
  })
})
