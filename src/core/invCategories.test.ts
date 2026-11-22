import { describe, expect, it } from 'vitest'
import { addCustomCat, countInCat, defaultInvCatOrder, isDefaultInvCatOrder, orderedInvCatKeys, removeCustomCat, resolveInvCat, validateCatName } from './invCategories'
import { invCatStyle, invToExpense } from './inventory'
import { migrate } from './migrate'
import { emptyAppData, INV_CATEGORIES, type InvCats, type InventoryItem } from './schema'

const cats = (order: string[] = [], custom: InvCats['custom'] = []): InvCats => ({ custom, order })
const item = (id: string, cat: string): InventoryItem => ({
  id,
  name: id,
  cat,
  unit: '',
  stock: 1,
  minStock: 1,
  lastReplaced: '',
  cycleDays: 0,
  expiry: '',
  openedDate: '',
  paoMonths: 0,
  note: '',
})

describe('庫存分類', () => {
  it('內建分類包含低溫食材與常溫食材，預設排在廚房耗材後面、其他永遠在最後', () => {
    expect(INV_CATEGORIES).toContain('chilled')
    expect(INV_CATEGORIES).toContain('pantry')
    const d = defaultInvCatOrder([{ id: 'c_pet', name: '寵物' }])
    expect(d.slice(2, 5)).toEqual(['kitchen', 'chilled', 'pantry'])
    expect(d.at(-2)).toBe('c_pet')
    expect(d.at(-1)).toBe('other')
  })

  it('沒排過序時用預設順序', () => {
    expect(orderedInvCatKeys(cats())).toEqual(defaultInvCatOrder([]))
  })

  it('舊的排序沒有新內建分類時，插在預設順序中前一個分類後面；忽略未知與重複的 key', () => {
    const old = ['other', 'stationery', 'kitchen', 'home', 'personal', 'health', 'skincare', 'gone', 'kitchen']
    expect(orderedInvCatKeys(cats(old))).toEqual(['other', 'stationery', 'kitchen', 'chilled', 'pantry', 'home', 'personal', 'health', 'skincare'])
  })

  it('自訂分類沒在排序裡時插在「其他」前面', () => {
    const r = orderedInvCatKeys(cats(['other', ...INV_CATEGORIES.filter((k) => k !== 'other')], [{ id: 'c_a', name: 'A' }]))
    expect(r[0]).toBe('c_a')
    expect(r[1]).toBe('other')
  })

  it('跟預設相同的順序判斷', () => {
    const c = cats([], [{ id: 'c_a', name: 'A' }])
    expect(isDefaultInvCatOrder(c, defaultInvCatOrder(c.custom))).toBe(true)
    expect(isDefaultInvCatOrder(c, [...defaultInvCatOrder(c.custom)].reverse())).toBe(false)
  })

  it('新增自訂分類：有排過序時也會出現在排序中', () => {
    const before = cats(['stationery', 'other'])
    const after = addCustomCat(before, '寵物', 'c_pet')
    expect(after.custom).toEqual([{ id: 'c_pet', name: '寵物' }])
    expect(after.order).toContain('c_pet')
    expect(after.order.indexOf('c_pet')).toBe(after.order.indexOf('other') - 1)
    expect(addCustomCat(cats(), '寵物', 'c_pet').order).toEqual([])
  })

  it('刪除自訂分類：用品改歸其他、從排序移除；內建分類不能刪', () => {
    const c = cats(['c_pet', 'other'], [{ id: 'c_pet', name: '寵物' }])
    const inv = [item('a', 'c_pet'), item('b', 'home'), item('c', 'c_pet')]
    const r = removeCustomCat(c, inv, 'c_pet')
    expect(r.moved).toBe(2)
    expect(r.inventory.map((x) => x.cat)).toEqual(['other', 'home', 'other'])
    expect(r.invCats).toEqual({ custom: [], order: ['other'] })
    expect(removeCustomCat(c, inv, 'home').moved).toBe(0)
  })

  it('找不到的分類當「其他」，計數也算在其他', () => {
    const c = cats([], [{ id: 'c_pet', name: '寵物' }])
    expect(resolveInvCat('c_pet', c)).toBe('c_pet')
    expect(resolveInvCat('c_gone', c)).toBe('other')
    expect(resolveInvCat('chilled', c)).toBe('chilled')
    expect(countInCat([item('a', 'c_gone'), item('b', 'other')], c, 'other')).toBe(2)
  })

  it('名稱驗證：不可空白、長度上限、不可重複（全形半形與大小寫視為相同）', () => {
    expect(validateCatName('   ', [])).toEqual({ ok: false, error: 'empty' })
    expect(validateCatName('一二三四五六七八九十一二三', [])).toEqual({ ok: false, error: 'tooLong' })
    expect(validateCatName('其他', ['其他'])).toEqual({ ok: false, error: 'duplicate' })
    expect(validateCatName('ＰＥＴ', ['pet'])).toEqual({ ok: false, error: 'duplicate' })
    expect(validateCatName('  寵物   用品 ', ['其他'])).toEqual({ ok: true, name: '寵物 用品' })
  })

  it('樣式與記帳分類：食材歸「食」，自訂分類有固定配色與標籤圖示', () => {
    expect(invToExpense('chilled')).toBe('food')
    expect(invToExpense('pantry')).toBe('food')
    expect(invToExpense('c_pet')).toBe('other')
    expect(invCatStyle('chilled').icon).toBe('fridge')
    expect(invCatStyle('pantry').icon).toBe('jar')
    expect(invCatStyle('c_pet')).toEqual(invCatStyle('c_pet'))
    expect(invCatStyle('c_pet').icon).toBe('tag')
    expect(invCatStyle('unknown')).toEqual(invCatStyle('other'))
  })

  it('舊資料沒有 invCats 時補預設值；自訂分類與排序可以完整讀回', () => {
    const { invCats: _drop, ...old } = emptyAppData()
    void _drop
    expect(migrate(old).invCats).toEqual({ custom: [], order: [] })
    const saved = { ...emptyAppData(), invCats: cats(['c_pet', 'other'], [{ id: 'c_pet', name: '寵物' }]), inventory: [item('a', 'c_pet')] }
    const back = migrate(JSON.parse(JSON.stringify(saved)))
    expect(back.invCats).toEqual(saved.invCats)
    expect(back.inventory[0]!.cat).toBe('c_pet')
  })
})
