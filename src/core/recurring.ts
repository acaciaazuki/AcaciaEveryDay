import { toLocalISO } from './date'
import type { BillingPeriod } from './expenses'
import { newId, type Archive, type Expense, type Recurring } from './schema'

/**
 * 扣款日落在本期的哪一天。週期是每月 10 日到次月 9 日：
 * 10 日（含）以後的扣款日在週期開始的那個月，1–9 日在下個月。
 * 那個月沒有這一天（例如 2 月 31 日）時用月底，結果一定落在週期內。
 */
export function dueDateInPeriod(day: number, period: BillingPeriod): string {
  const [y, m] = period.start.split('-').map(Number) as [number, number]
  const month = day >= 10 ? m - 1 : m // Date 的月份從 0 開始
  const last = new Date(y, month + 1, 0).getDate()
  return toLocalISO(new Date(y, month, Math.min(day, last)))
}

/** 本期已經帶入過的範本 id（記帳清單與歸檔都算，所以歸檔本期後也不會重複帶入） */
export function importedInPeriod(period: BillingPeriod, shopping: Expense[], archives: Archive[]): Set<string> {
  const ids = new Set<string>()
  const scan = (list: Expense[]) => {
    for (const e of list) if (e.recurringId && e.recurringPeriod === period.start) ids.add(e.recurringId)
  }
  scan(shopping)
  for (const a of archives) scan(a.expenses)
  return ids
}

/** 分期的顯示用文字資料：第 next 期／共 total 期 */
export const installmentOf = (r: Pick<Recurring, 'installments'>) => r.installments && { current: r.installments.next, total: r.installments.total }

export interface ImportPick {
  id: string
  /** 這一期的金額（可在帶入前微調，不會改到範本） */
  amount: number
  note: string
}

/**
 * 把勾選的範本寫成本期的記帳。已完成或本期已帶入的會略過。
 * 分期款帶入後期數加 1，最後一期帶入後自動標記完成。
 */
export function buildImports(
  templates: Recurring[],
  picks: ImportPick[],
  period: BillingPeriod,
  already: Set<string>,
  time = '12:00',
): { expenses: Expense[]; templates: Recurring[] } {
  const byId = new Map(templates.map((r) => [r.id, r]))
  const expenses: Expense[] = []
  const bumped = new Map<string, Recurring>()
  for (const p of picks) {
    const r = byId.get(p.id)
    if (!r || r.done || already.has(r.id) || bumped.has(r.id)) continue
    const inst = r.installments
    const note = p.note.trim()
    expenses.push({
      id: newId(),
      title: inst ? `${r.name}（${inst.next}/${inst.total}）` : r.name,
      amt: Number.isFinite(p.amount) && p.amount > 0 ? Math.round(p.amount * 100) / 100 : 0,
      store: '',
      cat: r.cat,
      customCat: r.cat === 'other' ? r.customCat || undefined : undefined,
      currency: r.currency,
      date: dueDateInPeriod(r.day, period),
      time,
      // 跟一般記帳一樣先是未勾選，實際扣款後可以自己打勾
      done: false,
      note: note || undefined,
      recurringId: r.id,
      recurringPeriod: period.start,
      installment: inst?.next,
    })
    if (inst) {
      const next = inst.next + 1
      bumped.set(r.id, { ...r, installments: { ...inst, next }, done: next > inst.total })
    } else {
      bumped.set(r.id, r)
    }
  }
  return { expenses, templates: templates.map((r) => bumped.get(r.id) ?? r) }
}

/**
 * 刪掉一筆帶入的分期記帳時，如果它正好是最近一次帶入的那期，就把範本的期數退回去，
 * 讓使用者重新帶入時期數不會跳號。其他情況（範本已刪、之後又帶入過）維持原狀。
 */
export function rollbackInstallment(templates: Recurring[], removed: Expense): Recurring[] {
  const n = removed.installment
  if (!removed.recurringId || n == null) return templates
  return templates.map((r) => {
    if (r.id !== removed.recurringId || !r.installments || r.installments.next !== n + 1) return r
    return { ...r, installments: { ...r.installments, next: n }, done: false }
  })
}
