import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { archiveCurrent, restoreArchive } from './archive'
import { summarize } from './expenses'
import { migrate } from './migrate'
import { buildImports, dueDateInPeriod, importedInPeriod, importedKeys, importKey, planImport, progressOf, rollbackInstallment, shiftPeriod } from './recurring'
import { emptyAppData, SCHEMA_VERSION, type Recurring } from './schema'
import { useAppStore } from '../store/useAppStore'

const period = { start: '2026-11-10', end: '2026-12-09' }
const tpl = (id: string, patch: Partial<Recurring> = {}): Recurring => ({ id, name: id, cat: 'housing', amount: 1000, currency: 'TWD', day: 10, batchMonths: 1, note: '', done: false, ...patch })

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
    ], period, new Set([importKey('a', period.start)]))
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
    s.addRecurring({ name: '信貸', cat: 'loan', amount: 5000, currency: 'TWD', day: 15, note: '', installments: { total: 12, next: 1 }, batchMonths: 1, done: false })
    const id = useAppStore.getState().recurring[0]!.id
    expect(s.importRecurring([{ id, amount: 5000, note: '' }], '2026-11-22').count).toBe(1)
    expect(s.importRecurring([{ id, amount: 5000, note: '' }], '2026-11-22').count).toBe(0)
    const st = useAppStore.getState()
    expect(st.shopping[0]).toMatchObject({ title: '信貸（1/12）', date: '2026-11-15', cat: 'loan' })
    expect(st.recurring[0]!.installments).toEqual({ total: 12, next: 2 })
    expect(st.exportData().recurring).toHaveLength(1)
    st.removeExpense(st.shopping[0]!.id)
    expect(useAppStore.getState().recurring[0]!.installments).toEqual({ total: 12, next: 1 })
    // 刪掉後本期可以重新帶入
    expect(useAppStore.getState().importRecurring([{ id, amount: 5000, note: '' }], '2026-11-22').count).toBe(1)
  })

  it('舊範本沒有 batchMonths 時補成 1 個月，分期資料不變', () => {
    const old = { ...emptyAppData(), recurring: [{ id: 'r', name: '舊分期', cat: 'loan', amount: 100, currency: 'TWD', day: 5, note: '', installments: { total: 6, next: 3 }, done: false }] } as Record<string, unknown>
    const d = migrate(old)
    expect(d.recurring[0]).toMatchObject({ batchMonths: 1, installments: { total: 6, next: 3 } })
    expect(progressOf(d.recurring[0]!)).toEqual({ paid: 2, total: 6 })
  })
})

describe('固定支出：一次批次加好幾個月', () => {
  it('週期往後推：跨年、2 月都正確', () => {
    expect(shiftPeriod(period, 1)).toEqual({ start: '2026-12-10', end: '2027-01-09' })
    expect(shiftPeriod(period, 3)).toEqual({ start: '2027-02-10', end: '2027-03-09' })
    expect(shiftPeriod(period, 0)).toEqual(period)
  })

  it('從本期起連續產生 N 個月，每月依扣款日規則（1–9 日在下個月、月底）', () => {
    const r = buildImports([tpl('rent', { day: 31, batchMonths: 4 }), tpl('phone', { day: 5, batchMonths: 2 })], [
      { id: 'rent', amount: 12000, note: '' },
      { id: 'phone', amount: 599, note: '' },
    ], period, new Set())
    expect(r.expenses.filter((e) => e.recurringId === 'rent').map((e) => [e.date, e.recurringPeriod])).toEqual([
      ['2026-11-30', '2026-11-10'],
      ['2026-12-31', '2026-12-10'],
      ['2027-01-31', '2027-01-10'],
      ['2027-02-28', '2027-02-10'],
    ])
    expect(r.expenses.filter((e) => e.recurringId === 'phone').map((e) => e.date)).toEqual(['2026-12-05', '2027-01-05'])
    // 只有本期的那筆算進本期總額
    expect(summarize(r.expenses, period, 'TWD').total).toBe(12599)
  })

  it('已加入的月份略過，不會重複', () => {
    const rent = tpl('rent', { batchMonths: 3 })
    const first = buildImports([rent], [{ id: 'rent', amount: 1, note: '' }], period, new Set([importKey('rent', '2026-12-10')]))
    expect(first.expenses.map((e) => e.recurringPeriod)).toEqual(['2026-11-10', '2027-01-10'])
    const keys = importedKeys([...first.expenses], [])
    keys.add(importKey('rent', '2026-12-10'))
    expect(planImport(rent, period, keys)).toEqual([])
    expect(buildImports([rent], [{ id: 'rent', amount: 1, note: '' }], period, keys).expenses).toEqual([])
    // 下一期再加：只會補後面還沒加過的月份
    expect(planImport(rent, shiftPeriod(period, 1), keys).map((m) => m.period.start)).toEqual(['2027-02-10'])
  })

  it('分期：已付到第 2 期、一次加 3 個月 → 產生第 3、4、5 期，進度更新為第 5 / 6 期', () => {
    const card = tpl('card', { batchMonths: 3, installments: { total: 6, next: 3 } })
    expect(progressOf(card)).toEqual({ paid: 2, total: 6 })
    const r = buildImports([card], [{ id: 'card', amount: 1000, note: '' }], period, new Set())
    expect(r.expenses.map((e) => [e.title, e.installment])).toEqual([
      ['card（3/6）', 3],
      ['card（4/6）', 4],
      ['card（5/6）', 5],
    ])
    expect(r.templates[0]).toMatchObject({ installments: { total: 6, next: 6 }, done: false })
    expect(progressOf(r.templates[0]!)).toEqual({ paid: 5, total: 6 })
    expect(r.completed).toEqual([])
  })

  it('分期：超過總期數就不再產生，付完最後一期標記完成並回報', () => {
    const card = tpl('card', { batchMonths: 3, installments: { total: 6, next: 5 } })
    const r = buildImports([card], [{ id: 'card', amount: 1000, note: '' }], period, new Set())
    expect(r.expenses.map((e) => e.installment)).toEqual([5, 6])
    expect(r.templates[0]).toMatchObject({ installments: { next: 7 }, done: true })
    expect(progressOf(r.templates[0]!)).toEqual({ paid: 6, total: 6 })
    expect(r.completed.map((x) => x.id)).toEqual(['card'])
    // 刪掉最後一期會退回並取消完成
    expect(rollbackInstallment(r.templates, r.expenses[1]!)[0]).toMatchObject({ installments: { next: 6 }, done: false })
  })

  it('分期遇到已加入的月份：期數照順序接下去，不跳號', () => {
    const card = tpl('card', { batchMonths: 3, installments: { total: 12, next: 4 } })
    const r = buildImports([card], [{ id: 'card', amount: 1, note: '' }], period, new Set([importKey('card', period.start)]))
    expect(r.expenses.map((e) => [e.recurringPeriod, e.installment])).toEqual([
      ['2026-12-10', 4],
      ['2027-01-10', 5],
    ])
    expect(r.templates[0]!.installments).toEqual({ total: 12, next: 6 })
  })

  it('store：多月份帶入一次寫入，完成的名稱回傳給畫面提示', () => {
    useAppStore.setState(emptyAppData())
    const s = useAppStore.getState()
    s.addRecurring({ name: '手機分期', cat: 'loan', amount: 500, currency: 'TWD', day: 15, note: '', batchMonths: 3, installments: { total: 3, next: 2 }, done: false })
    const id = useAppStore.getState().recurring[0]!.id
    expect(s.importRecurring([{ id, amount: 500, note: '' }], '2026-11-22')).toEqual({ count: 2, completed: ['手機分期'] })
    const st = useAppStore.getState()
    expect(st.shopping.map((e) => e.title).sort()).toEqual(['手機分期（2/3）', '手機分期（3/3）'])
    expect(st.recurring[0]).toMatchObject({ done: true, installments: { next: 4 } })
    expect(st.exportData().recurring[0]!.batchMonths).toBe(3)
  })
})
