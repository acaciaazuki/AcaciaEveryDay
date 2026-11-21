import { describe, expect, it } from 'vitest'
import { archiveCurrent, archiveEnded, ledgerYears, periodOf, restoreArchive } from './archive'
import { migrate } from './migrate'
import { emptyAppData, type Expense } from './schema'

const ex = (id: string, date: string, amt = 100): Expense => ({ id, title: id, amt, store: '', cat: 'food', date, time: '12:00', done: false })

describe('periodOf', () => {
  it('每月 10 日到次月 9 日，跨年週期以開始日為準', () => {
    expect(periodOf('2026-11-21')).toEqual({ start: '2026-11-10', end: '2026-12-09' })
    expect(periodOf('2026-12-09')).toEqual({ start: '2026-11-10', end: '2026-12-09' })
    expect(periodOf('2026-12-10')).toEqual({ start: '2026-12-10', end: '2027-01-09' })
    expect(periodOf('2027-01-05')).toEqual({ start: '2026-12-10', end: '2027-01-09' })
  })
})

describe('archiveEnded', () => {
  const list = [ex('a', '2026-10-15'), ex('b', '2026-11-12'), ex('c', '2026-12-20'), ex('d', ''), ex('e', '2027-01-05')]

  it('新週期開始後，只歸檔已結束的週期，本期、未來與沒日期的留在清單', () => {
    // 今天是 2026-12-10：11/10–12/09 剛結束
    const r = archiveEnded(list, [], '2026-12-10', 1)
    expect(r.count).toBe(2)
    expect(r.shopping.map((e) => e.id)).toEqual(['c', 'd', 'e'])
    expect(r.archives.map((a) => a.start)).toEqual(['2026-11-10', '2026-10-10'])
    expect(r.archives[0]).toMatchObject({ start: '2026-11-10', end: '2026-12-09' })
    expect(r.archives[0].expenses.map((e) => e.id)).toEqual(['b'])
  })

  it('週期還沒結束、或沒有可歸檔的記帳時不產生空白歸檔', () => {
    const r = archiveEnded([ex('x', '2026-11-12')], [], '2026-12-09', 1)
    expect(r.count).toBe(0)
    expect(r.archives).toEqual([])
    expect(archiveEnded([], [], '2026-12-10', 1).archives).toEqual([])
  })

  it('同一期再歸檔時併進既有那一期，不重複', () => {
    const first = archiveEnded([ex('b', '2026-11-12')], [], '2026-12-10', 1)
    const second = archiveEnded([ex('b', '2026-11-12', 999), ex('z', '2026-11-30')], first.archives, '2026-12-20', 2)
    expect(second.archives).toHaveLength(1)
    expect(second.archives[0].expenses.map((e) => [e.id, e.amt])).toEqual([['b', 999], ['z', 100]])
  })
})

describe('archiveCurrent / restoreArchive', () => {
  it('立即歸檔只收本期，之後可還原', () => {
    const list = [ex('a', '2026-11-12'), ex('b', '2026-11-30'), ex('old', '2026-10-01'), ex('future', '2026-12-20')]
    const r = archiveCurrent(list, [], '2026-11-21', 5)
    expect(r.count).toBe(2)
    expect(r.shopping.map((e) => e.id)).toEqual(['old', 'future'])
    expect(r.archives[0]).toMatchObject({ start: '2026-11-10', end: '2026-12-09', archivedAt: 5 })

    const back = restoreArchive(r.shopping, r.archives, '2026-11-10')
    expect(back.archives).toEqual([])
    expect(back.shopping.map((e) => e.id).sort()).toEqual(['a', 'b', 'future', 'old'])
  })
})

describe('ledgerYears', () => {
  it('依週期開始日分年，跨年週期歸開始那一年', () => {
    const mk = (start: string, end: string) => ({ start, end, archivedAt: 0, expenses: [] })
    const years = ledgerYears([mk('2026-11-10', '2026-12-09'), mk('2026-12-10', '2027-01-09'), mk('2027-01-10', '2027-02-09'), mk('2026-10-10', '2026-11-09')])
    expect(years.map((y) => y.year)).toEqual(['2027', '2026'])
    expect(years[1].periods.map((p) => p.start)).toEqual(['2026-12-10', '2026-11-10', '2026-10-10'])
    expect(years[0].periods.map((p) => p.start)).toEqual(['2027-01-10'])
  })
})

describe('資料相容', () => {
  it('沒有 archives 欄位的 v2 資料讀進來補空陣列', () => {
    const { archives: _drop, ...old } = emptyAppData()
    void _drop
    expect(migrate(old).archives).toEqual([])
  })
  it('有歸檔的資料原樣保留', () => {
    const data = { ...emptyAppData(), archives: [{ start: '2026-11-10', end: '2026-12-09', archivedAt: 3, expenses: [ex('a', '2026-11-12')] }] }
    expect(migrate(JSON.parse(JSON.stringify(data))).archives).toEqual(data.archives)
  })
})
