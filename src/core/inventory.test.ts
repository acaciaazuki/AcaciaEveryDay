import { describe, expect, it } from 'vitest'
import { dueDates, dueTone, isDue, isLow, matchesFilter, nextReplace, paoDate, restockQty, sampleInventory, shoppingLink, sortInventory } from './inventory'
import type { Expense, InventoryItem } from './schema'

const today = '2026-11-22'
const item = (p: Partial<InventoryItem> = {}): InventoryItem => ({
  id: 'i1',
  name: '牙刷',
  cat: 'personal',
  unit: '支',
  stock: 2,
  minStock: 1,
  lastReplaced: '',
  cycleDays: 0,
  expiry: '',
  openedDate: '',
  paoMonths: 0,
  note: '',
  ...p,
})

describe('庫存與到期計算', () => {
  it('下次更換日＝上次更換日＋週期；沒設定週期時不追蹤', () => {
    expect(nextReplace(item({ lastReplaced: '2026-11-01', cycleDays: 30 }))).toBe('2026-12-01')
    expect(nextReplace(item({ lastReplaced: '2026-11-01' }))).toBe('')
  })

  it('開封後期限依月份推算，月底自動取該月最後一天', () => {
    expect(paoDate(item({ openedDate: '2026-08-31', paoMonths: 6 }))).toBe('2027-02-28')
    expect(paoDate(item({ openedDate: '2026-08-31' }))).toBe('')
  })

  it('到期日由近到遠，負數是已逾期', () => {
    const x = item({ lastReplaced: '2026-08-01', cycleDays: 90, expiry: '2027-01-01' })
    expect(dueDates(x, today)).toEqual([
      { kind: 'replace', date: '2026-10-30', daysLeft: -23 },
      { kind: 'expiry', date: '2027-01-01', daysLeft: 40 },
    ])
    expect(isDue(x, today)).toBe(true)
  })

  it('7 天內才算即期；警示顏色分逾期、3 天內、7 天內、還早', () => {
    expect(isDue(item({ expiry: '2026-11-29' }), today)).toBe(true)
    expect(isDue(item({ expiry: '2026-11-30' }), today)).toBe(false)
    expect([-1, 0, 3, 4, 7, 8].map(dueTone)).toEqual(['overdue', 'urgent', 'urgent', 'soon', 'soon', 'ok'])
  })

  it('庫存 ≤ 安全庫存就要補貨，建議數量是差額、至少 1', () => {
    expect(isLow(item({ stock: 1, minStock: 1 }))).toBe(true)
    expect(isLow(item({ stock: 2, minStock: 1 }))).toBe(false)
    expect(restockQty(item({ stock: 1, minStock: 4 }))).toBe(3)
    expect(restockQty(item({ stock: 1, minStock: 1 }))).toBe(1)
  })

  it('篩選：需補貨與庫存充足互斥', () => {
    const low = item({ stock: 0 })
    expect(matchesFilter(low, 'low', today)).toBe(true)
    expect(matchesFilter(low, 'ok', today)).toBe(false)
    expect(matchesFilter(item(), 'ok', today)).toBe(true)
  })

  it('購物清單連動：找不到那一筆就視為沒加入，打勾後算已買到', () => {
    const e = { id: 'e1', done: false } as Expense
    expect(shoppingLink(item(), [e]).state).toBe('none')
    expect(shoppingLink(item({ shoppingId: 'e1' }), [e]).state).toBe('pending')
    expect(shoppingLink(item({ shoppingId: 'e1' }), [{ ...e, done: true }]).state).toBe('bought')
    expect(shoppingLink(item({ shoppingId: 'e1' }), []).state).toBe('none')
  })

  it('排序：即期在前，再來是待補貨', () => {
    const a = item({ id: 'a', name: 'A' })
    const b = item({ id: 'b', name: 'B', stock: 0 })
    const c = item({ id: 'c', name: 'C', expiry: '2026-11-23' })
    expect(sortInventory([a, b, c], today).map((x) => x.id)).toEqual(['c', 'b', 'a'])
  })

  it('範例 4 筆涵蓋即期、逾期、待補貨', () => {
    const s = sampleInventory(today, (k, f) => `${k}.${f}`).map((x, i) => ({ ...x, id: String(i) }))
    expect(s).toHaveLength(4)
    expect(s.filter((x) => isDue(x, today))).toHaveLength(3)
    expect(s.filter(isLow).map((x) => x.name)).toEqual(['sponge.name', 'tissue.name'])
    expect(dueDates(s[1]!, today)[0]!.daysLeft).toBe(-5)
  })
})
