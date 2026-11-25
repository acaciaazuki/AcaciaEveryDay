import { toLocalISO } from './date'
import type { BillingPeriod } from './expenses'
import { newId, type Archive, type Expense, type Recurring } from './schema'

/** 一次批次最多加幾個月 */
export const BATCH_MONTHS_MAX = 12

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

/** 往後（或往前）k 個週期：週期開始日一定是 10 日，所以直接加月份 */
export function shiftPeriod(period: BillingPeriod, k: number): BillingPeriod {
  const [y, m] = period.start.split('-').map(Number) as [number, number]
  return { start: toLocalISO(new Date(y, m - 1 + k, 10)), end: toLocalISO(new Date(y, m + k, 9)) }
}

/** 「範本 id＋週期開始日」的識別字串，用來判斷某個月份是否已加入 */
export const importKey = (recurringId: string, periodStart: string) => `${recurringId}@${periodStart}`

/** 所有已經帶入過的「範本＋週期」（記帳清單與歸檔都算，所以歸檔後也不會重複帶入） */
export function importedKeys(shopping: Expense[], archives: Archive[]): Set<string> {
  const keys = new Set<string>()
  const scan = (list: Expense[]) => {
    for (const e of list) if (e.recurringId && e.recurringPeriod) keys.add(importKey(e.recurringId, e.recurringPeriod))
  }
  scan(shopping)
  for (const a of archives) scan(a.expenses)
  return keys
}

/** 舊資料或亂填的批次月數一律收斂到 1–12 */
export const batchMonthsOf = (r: Pick<Recurring, 'batchMonths'>) => Math.min(BATCH_MONTHS_MAX, Math.max(1, Math.floor(Number(r.batchMonths) || 1)))

/** 分期進度：已付到第 paid 期／共 total 期（paid = next − 1） */
export const progressOf = (r: Pick<Recurring, 'installments'>) =>
  r.installments && { paid: Math.min(r.installments.total, Math.max(0, r.installments.next - 1)), total: r.installments.total }

export interface PlannedMonth {
  period: BillingPeriod
  date: string
  /** 分期款的第幾期；不是分期就沒有 */
  installment?: number
}

/**
 * 這個範本這次批次會產生哪些月份：從 period 起連續 batchMonths 個週期，
 * 略過已加入的月份；分期款從 next 起依序編號，超過總期數就不再產生。
 */
export function planImport(r: Recurring, period: BillingPeriod, already: Set<string>): PlannedMonth[] {
  if (r.done) return []
  const inst = r.installments
  const out: PlannedMonth[] = []
  for (let k = 0; k < batchMonthsOf(r); k++) {
    const p = shiftPeriod(period, k)
    if (already.has(importKey(r.id, p.start))) continue
    const installment = inst ? inst.next + out.length : undefined
    if (inst && installment! > inst.total) break
    out.push({ period: p, date: dueDateInPeriod(r.day, p), installment })
  }
  return out
}

export interface ImportPick {
  id: string
  /** 每一期的金額（可在帶入前微調，不會改到範本） */
  amount: number
  note: string
}

export interface ImportResult {
  expenses: Expense[]
  templates: Recurring[]
  /** 這次帶入後剛好付完最後一期、自動標記完成的範本 */
  completed: Recurring[]
}

/**
 * 把勾選的範本寫成記帳：每個範本依自己的批次月數，從本期起連續產生，已加入的月份略過。
 * 分期款依序編號，帶入後 next 前進，最後一期帶入後自動標記完成。
 */
export function buildImports(templates: Recurring[], picks: ImportPick[], period: BillingPeriod, already: Set<string>, time = '12:00'): ImportResult {
  const byId = new Map(templates.map((r) => [r.id, r]))
  const expenses: Expense[] = []
  const bumped = new Map<string, Recurring>()
  const completed: Recurring[] = []
  for (const p of picks) {
    const r = byId.get(p.id)
    if (!r || bumped.has(r.id)) continue
    const plan = planImport(r, period, already)
    if (plan.length === 0) continue
    const inst = r.installments
    const note = p.note.trim()
    const amt = Number.isFinite(p.amount) && p.amount > 0 ? Math.round(p.amount * 100) / 100 : 0
    for (const m of plan) {
      expenses.push({
        id: newId(),
        title: inst ? `${r.name}（${m.installment}/${inst.total}）` : r.name,
        amt,
        store: '',
        cat: r.cat,
        customCat: r.cat === 'other' ? r.customCat || undefined : undefined,
        currency: r.currency,
        date: m.date,
        time,
        // 跟一般記帳一樣先是未勾選，實際扣款後可以自己打勾
        done: false,
        note: note || undefined,
        recurringId: r.id,
        recurringPeriod: m.period.start,
        installment: m.installment,
      })
    }
    if (inst) {
      const next = inst.next + plan.length
      const done = next > inst.total
      const updated = { ...r, installments: { ...inst, next }, done }
      bumped.set(r.id, updated)
      if (done) completed.push(updated)
    } else {
      bumped.set(r.id, r)
    }
  }
  return { expenses, templates: templates.map((r) => bumped.get(r.id) ?? r), completed }
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
