import { describe, expect, it } from 'vitest'
import { billingPeriod, expenseCurrency, summarize } from './expenses'
import type { Expense } from './schema'

const e = (date: string, amt: number, cat: Expense['cat'] = 'food', customCat?: string, currency?: string): Expense => ({
  id: date + amt, title: 'x', amt, store: '', cat, customCat, date, time: '', done: false, currency,
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
    expect(r.byCategory).toEqual([['custom:寵物', [['TWD', 300]]], ['food', [['TWD', 100]]], ['transport', [['TWD', 50]]]])
  })

  it('不同幣別分開加總、不相加；預設貨幣排第一', () => {
    const p = { start: '2026-11-10', end: '2026-12-09' }
    const r = summarize([e('2026-11-11', 1200), e('2026-11-12', 15, 'food', undefined, 'USD'), e('2026-11-13', 0.1, 'food', undefined, 'USD'), e('2026-11-14', 0.2, 'food', undefined, 'USD'), e('2026-11-15', 90, 'other', undefined, '฿')], p)
    expect(r.totals).toEqual([['TWD', 1200], ['USD', 15.3], ['฿', 90]])
    expect(r.total).toBe(1200)
    expect(r.byCategory).toEqual([['food', [['TWD', 1200], ['USD', 15.3]]], ['other', [['฿', 90]]]])
  })

  it('舊資料沒有幣別時當作傳入的預設貨幣；金額 0 不產生小計', () => {
    const p = { start: '2026-11-10', end: '2026-12-09' }
    const r = summarize([e('2026-11-11', 500), e('2026-11-12', 300, 'food', undefined, 'TWD'), e('2026-11-13', 0, 'food', undefined, 'KRW')], p, 'JPY')
    expect(r.totals).toEqual([['JPY', 500], ['TWD', 300]])
    expect(r.total).toBe(500)
  })
})

describe('expenseCurrency', () => {
  it('有幣別用自己的，沒有就用預設貨幣', () => {
    expect(expenseCurrency({ currency: 'USD' }, 'TWD')).toBe('USD')
    expect(expenseCurrency({}, 'JPY')).toBe('JPY')
    expect(expenseCurrency({})).toBe('TWD')
  })
})
