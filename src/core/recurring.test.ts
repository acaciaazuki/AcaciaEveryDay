import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { archiveCurrent, restoreArchive } from './archive'
import { summarize } from './expenses'
import { migrate } from './migrate'
import { buildImports, dueDateInPeriod, importedInPeriod, rollbackInstallment } from './recurring'
import { emptyAppData, SCHEMA_VERSION, type Recurring } from './schema'
import { useAppStore } from '../store/useAppStore'

const period = { start: '2026-11-10', end: '2026-12-09' }
const tpl = (id: string, patch: Partial<Recurring> = {}): Recurring => ({ id, name: id, cat: 'housing', amount: 1000, currency: 'TWD', day: 10, note: '', done: false, ...patch })

describe('固定支出：扣款日落在本期', () => {
  it('10 日以後在週期開始的月份，1–9 日在下個月', () => {
    expect(dueDateInPeriod(10, period)).toBe('2026-11-10')
    expect(dueDateInPeriod(25, period)).toBe('2026-11-25')
    expect(dueDateInPeriod(5, period)).toBe('2026-12-05')
    expect(dueDateInPeriod(9, period)).toBe('2026-12-09')
  })
  it('該月沒有那一天時用月底，仍在週期內', () => {
    expect(dueDateInPeriod(31, period)).toBe('2026-11-30')
    expect(dueDateInPeriod(31, { start: '2027-02-10', end: '2027-03-09' })).toBe('2027-02-28')
    expect(dueDateInPeriod(30, { start: '2028-02-10', end: '2028-03-09' })).toBe('2028-02-29')
  })
})

describe('固定支出：批次帶入', () => {
  it('寫成本期記帳，計入本期總額與分類統計', () => {
    const r = buildImports([tpl('phone', { cat: 'other', customCat: '通訊', amount: 599, day: 5 }), tpl('rent', { amount: 12000 })], [
      { id: 'phone', amount: 650, note: '含漫遊 ' },
      { id: 'rent', amount: 12000, note: '' },
    ], period, new Set())
    expect(r.expenses).toHaveLength(2)
    expect(r.expenses[0]).toMatchObject({ title: 'phone', amt: 650, cat: 'other', customCat: '通訊', date: '2026-12-05', note: '含漫遊', recurringId: 'phone', recurringPeriod: '2026-11-10', done: false })
    expect(r.expenses[1]!.note).toBeUndefined()
    const s = summarize(r.expenses, period, 'TWD')
    expect(s.total).toBe(12650)
    expect(Object.fromEntries(s.byCategory.map(([k, v]) => [k, v[0]![1]]))).toEqual({ housing: 12000, 'custom:通訊': 650 })
  })

  it('本期已帶入、已完成、重複勾選的都略過', () => {
    const r = buildImports([tpl('a'), tpl('b', { done: true }), tpl('c')], [
      { id: 'a', amount: 1, note: '' },
      { id: 'b', amount: 1, note: '' },
      { id: 'c', amount: 1, note: '' },
      { id: 'c', amount: 1, note: '' },
    ], period, new Set(['a']))
    expect(r.expenses.map((e) => e.recurringId)).toEqual(['c'])
  })

  it('分期：期數加 1，最後一期帶入後自動完成；刪掉最近一期會退回', () => {
    let list = [tpl('card', { installments: { total: 3, next: 2 } })]
    const first = buildImports(list, [{ id: 'card', amount: 1000, note: '' }], period, new Set())
    expect(first.expenses[0]).toMatchObject({ title: 'card（2/3）', installment: 2 })
    list = first.templates
    expect(list[0]).toMatchObject({ installments: { total: 3, next: 3 }, done: false })
    const last = buildImports(list, [{ id: 'card', amount: 1000, note: '' }], { start: '2026-12-10', end: '2027-01-09' }, new Set())
    expect(last.templates[0]).toMatchObject({ installments: { next: 4 }, done: true })
    // 刪掉最後一期：退回第 3 期、取消完成
    expect(rollbackInstallment(last.templates, last.expenses[0]!)[0]).toMatchObject({ installments: { next: 3 }, done: false })
    // 刪掉比較早的那期：不動
    expect(rollbackInstallment(last.templates, first.expenses[0]!)[0]).toBe(last.templates[0])
  })

  it('已加入標記以範本 id＋週期判斷：歸檔本期後仍算已加入，下一期可再帶入；還原後也不重複', () => {
    const { expenses } = buildImports([tpl('rent')], [{ id: 'rent', amount: 1, note: '' }], period, new Set())
    expect(importedInPeriod(period, expenses, [])).toEqual(new Set(['rent']))
    const archived = archiveCurrent(expenses, [], '2026-11-22', 1)
    expect(archived.shopping).toEqual([])
    expect(importedInPeriod(period, archived.shopping, archived.archives)).toEqual(new Set(['rent']))
    expect(importedInPeriod({ start: '2026-12-10', end: '2027-01-09' }, archived.shopping, archived.archives).size).toBe(0)
    const restored = restoreArchive(archived.shopping, archived.archives, period.start)
    expect(importedInPeriod(period, restored.shopping, restored.archives)).toEqual(new Set(['rent']))
  })
})

describe('固定支出：資料', () => {
  beforeEach(() => useAppStore.setState(emptyAppData()))

  it('舊資料沒有 recurring 欄位時補空清單，舊記帳不受影響', () => {
    const old = { ...emptyAppData(), shopping: [{ id: 'x', title: '保費', amt: 100, store: '', cat: 'other', customCat: '保險', date: '2026-11-11', time: '', done: false }] } as Record<string, unknown>
    delete old.recurring
    const d = migrate(old)
    expect(d.schemaVersion).toBe(SCHEMA_VERSION)
    expect(d.recurring).toEqual([])
    expect(d.shopping[0]).toMatchObject({ cat: 'other', customCat: '保險' })
  })

  it('store：帶入、防重複、匯出包含範本、刪除帶入的分期會退回期數', () => {
    const s = useAppStore.getState()
    s.addRecurring({ name: '信貸', cat: 'loan', amount: 5000, currency: 'TWD', day: 15, note: '', installments: { total: 12, next: 1 }, done: false })
    const id = useAppStore.getState().recurring[0]!.id
    expect(s.importRecurring([{ id, amount: 5000, note: '' }], '2026-11-22')).toBe(1)
    expect(s.importRecurring([{ id, amount: 5000, note: '' }], '2026-11-22')).toBe(0)
    const st = useAppStore.getState()
    expect(st.shopping[0]).toMatchObject({ title: '信貸（1/12）', date: '2026-11-15', cat: 'loan' })
    expect(st.recurring[0]!.installments).toEqual({ total: 12, next: 2 })
    expect(st.exportData().recurring).toHaveLength(1)
    st.removeExpense(st.shopping[0]!.id)
    expect(useAppStore.getState().recurring[0]!.installments).toEqual({ total: 12, next: 1 })
    // 刪掉後本期可以重新帶入
    expect(useAppStore.getState().importRecurring([{ id, amount: 5000, note: '' }], '2026-11-22')).toBe(1)
  })
})
