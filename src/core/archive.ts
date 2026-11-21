import { billingPeriod, type BillingPeriod } from './expenses'
import type { Archive, Expense } from './schema'

interface Result {
  shopping: Expense[]
  archives: Archive[]
  count: number
}

/** 這筆記帳日期落在哪個結算週期（每月 10 日到次月 9 日） */
export const periodOf = (dateISO: string): BillingPeriod => billingPeriod(new Date(`${dateISO}T00:00`))

/**
 * 依 pick 把記帳從清單搬進歸檔。pick 回傳 null 的留在清單。
 * 同一個週期（以開始日識別）已經有歸檔時會併進去，不會產生重複的一期。
 */
function archiveBy(shopping: Expense[], archives: Archive[], pick: (e: Expense) => BillingPeriod | null, now: number): Result {
  const groups = new Map<string, { period: BillingPeriod; items: Expense[] }>()
  const keep: Expense[] = []
  for (const e of shopping) {
    const p = pick(e)
    if (!p) {
      keep.push(e)
      continue
    }
    const g = groups.get(p.start) ?? { period: p, items: [] }
    g.items.push(e)
    groups.set(p.start, g)
  }
  if (groups.size === 0) return { shopping, archives, count: 0 }

  const next = new Map(archives.map((a) => [a.start, a]))
  let count = 0
  for (const { period, items } of groups.values()) {
    const old = next.get(period.start)
    const ids = new Set(items.map((i) => i.id))
    const merged = [...(old?.expenses.filter((x) => !ids.has(x.id)) ?? []), ...items]
    next.set(period.start, { start: period.start, end: period.end, archivedAt: now, expenses: merged })
    count += items.length
  }
  const sorted = [...next.values()].sort((a, b) => b.start.localeCompare(a.start))
  return { shopping: keep, archives: sorted, count }
}

/** 自動歸檔：週期已結束（日期早於本期開始日）的記帳，依各自的週期收進年度記帳本 */
export function archiveEnded(shopping: Expense[], archives: Archive[], todayISO: string, now: number): Result {
  const current = periodOf(todayISO)
  return archiveBy(shopping, archives, (e) => (e.date && e.date < current.start ? periodOf(e.date) : null), now)
}

/** 立即歸檔本期：把日期落在本期內的記帳封存 */
export function archiveCurrent(shopping: Expense[], archives: Archive[], todayISO: string, now: number): Result {
  const current = periodOf(todayISO)
  return archiveBy(shopping, archives, (e) => (e.date && e.date >= current.start && e.date <= current.end ? current : null), now)
}

/** 把某一期的歸檔還原回記帳清單 */
export function restoreArchive(shopping: Expense[], archives: Archive[], start: string): Pick<Result, 'shopping' | 'archives'> {
  const target = archives.find((a) => a.start === start)
  if (!target) return { shopping, archives }
  return { shopping: [...target.expenses, ...shopping], archives: archives.filter((a) => a.start !== start) }
}

/** 年度記帳本：依週期開始日的年份分組，年份新到舊，每年內的週期也由新到舊 */
export function ledgerYears(archives: Archive[]): { year: string; periods: Archive[] }[] {
  const byYear = new Map<string, Archive[]>()
  for (const a of archives) {
    const y = a.start.slice(0, 4)
    byYear.set(y, [...(byYear.get(y) ?? []), a])
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, periods]) => ({ year, periods: periods.sort((a, b) => b.start.localeCompare(a.start)) }))
}
