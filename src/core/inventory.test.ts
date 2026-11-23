import { describe, expect, it } from 'vitest'
import { dueDates, dueTone, inventoryFor, isDue, isLow, lowStockReminders, matchesFilter, nextReplace, paoDate, restockQty, sampleInventory, shoppingLink, sortInventory, toggleShoppingStock, unitOptions } from './inventory'
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

  it('庫存低於安全庫存才要補貨（等於算足夠、安全庫存 0 不提醒），建議數量是差額、至少 1', () => {
    expect(isLow(item({ stock: 0, minStock: 1 }))).toBe(true)
    expect(isLow(item({ stock: 1, minStock: 1 }))).toBe(false)
    expect(isLow(item({ stock: 0, minStock: 0 }))).toBe(false)
    expect(isLow(item({ stock: 2, minStock: 1 }))).toBe(false)
    expect(restockQty(item({ stock: 1, minStock: 4 }))).toBe(3)
    expect(restockQty(item({ stock: 0, minStock: 1 }))).toBe(1)
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

describe('庫存不足提醒與購物清單自動入庫', () => {
  const exp = (p: Partial<Expense> = {}): Expense => ({ id: 'e1', title: '牙刷', amt: 0, store: '', cat: 'housing', date: today, time: '', done: false, ...p })

  it('低於安全庫存才出現在稍後辦，已在購物清單的標示出來並排在後面', () => {
    const inv = [item({ id: 'a', name: '衛生紙', stock: 1, minStock: 4, shoppingId: 'e1' }), item({ id: 'b', name: '牙刷', stock: 0, minStock: 1 }), item({ id: 'c', name: '海綿', stock: 2, minStock: 2 })]
    const r = lowStockReminders(inv, [exp({ title: '衛生紙', quantity: 3 })])
    expect(r.map((x) => [x.item.id, x.need, x.pending?.id])).toEqual([
      ['b', 1, undefined],
      ['a', 3, 'e1'],
    ])
  })

  it('購物清單手動新增、名稱相同（不分大小寫與全半形）也算同一個用品；固定支出帶入的不算', () => {
    const inv = [item({ id: 'a', name: 'Kleenex' })]
    expect(inventoryFor(exp({ title: ' ｋｌｅｅｎｅｘ ' }), inv)?.id).toBe('a')
    expect(inventoryFor(exp({ title: 'Kleenex', recurringId: 'r1' }), inv)).toBeUndefined()
    expect(inventoryFor(exp({ title: '別的' }), inv)).toBeUndefined()
  })

  it('打勾自動入庫、提醒消失；反覆勾選取消庫存不會重複增加', () => {
    let inv = [item({ id: 'a', stock: 0, minStock: 2, shoppingId: 'e1' })]
    let shop = [exp({ quantity: 2 })]
    let r = toggleShoppingStock(shop, inv, 'e1')
    expect(r.change?.qty).toBe(2)
    expect(r.inventory[0]).toMatchObject({ stock: 2, shoppingId: undefined })
    expect(r.shopping[0]).toMatchObject({ done: true, stockedItemId: 'a', stockedQty: 2 })
    expect(lowStockReminders(r.inventory, r.shopping)).toEqual([])
    for (let i = 0; i < 3; i++) {
      r = toggleShoppingStock(r.shopping, r.inventory, 'e1')
      r = toggleShoppingStock(r.shopping, r.inventory, 'e1')
    }
    expect(r.inventory[0].stock).toBe(2)
    // 取消打勾：扣回、重新連回這一筆，提醒顯示「已在購物清單」
    r = toggleShoppingStock(r.shopping, r.inventory, 'e1')
    expect(r.inventory[0]).toMatchObject({ stock: 0, shoppingId: 'e1' })
    expect(r.shopping[0].stockedItemId).toBeUndefined()
    expect(lowStockReminders(r.inventory, r.shopping)[0].pending?.id).toBe('e1')
    inv = r.inventory
    shop = r.shopping
    expect(inv[0].stock).toBe(0)
    expect(shop[0].done).toBe(false)
  })

  it('買得不夠多：照樣入庫，但還低於安全庫存時提醒繼續顯示', () => {
    const r = toggleShoppingStock([exp({ quantity: 1 })], [item({ id: 'a', stock: 0, minStock: 3 })], 'e1')
    expect(r.inventory[0].stock).toBe(1)
    expect(lowStockReminders(r.inventory, r.shopping).map((x) => x.need)).toEqual([2])
  })

  it('沒填數量當 1；對不到用品的只切換打勾；扣回最低到 0', () => {
    expect(toggleShoppingStock([exp()], [item({ id: 'a', stock: 0 })], 'e1').inventory[0].stock).toBe(1)
    const none = toggleShoppingStock([exp({ title: '咖啡豆' })], [item()], 'e1')
    expect(none.change).toBeUndefined()
    expect(none.shopping[0].done).toBe(true)
    const back = toggleShoppingStock([exp({ done: true, stockedItemId: 'a', stockedQty: 5 })], [item({ id: 'a', stock: 2 })], 'e1')
    expect(back.inventory[0].stock).toBe(0)
  })

  it('舊資料：打勾前就存在的已勾選記帳沒有入庫記號，取消打勾不會扣庫存', () => {
    const r = toggleShoppingStock([exp({ done: true, quantity: 3 })], [item({ id: 'a', stock: 5, shoppingId: 'e1' })], 'e1')
    expect(r.inventory[0].stock).toBe(5)
    expect(r.change).toBeUndefined()
  })
})

describe('unitOptions', () => {
  it('先列內建，再列用過的自訂單位（去重、去空白），內建不重複', () => {
    expect(unitOptions(['個', '包'], [{ unit: '罐' }, { unit: ' 包 ' }, { unit: '' }, { unit: '罐' }, { unit: '公斤' }], '袋')).toEqual(['個', '包', '公斤', '罐', '袋'])
  })
})
