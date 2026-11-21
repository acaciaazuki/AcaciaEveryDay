import type { ExpenseCategory } from './categories'
import type { IconName } from './icons'
import { toLocalISO } from './date'
import type { Expense } from './schema'

/** 舊版預算固定 20,000，之後可以搬到設定頁 */
export const DEFAULT_BUDGET = 20000

/** 舊版 .cat-* 的配色 */
export const EXPENSE_STYLE: Record<ExpenseCategory, { bg: string; fg: string; icon: IconName }> = {
  food: { bg: '#ffebee', fg: '#c62828', icon: 'food' },
  clothing: { bg: '#fff3e0', fg: '#ef6c00', icon: 'clothing' },
  housing: { bg: '#e8f5e9', fg: '#2e7d32', icon: 'housing' },
  transport: { bg: '#e3f2fd', fg: '#1565c0', icon: 'transport' },
  education: { bg: '#f3e5f5', fg: '#6a1b9a', icon: 'education' },
  leisure: { bg: '#fce4ec', fg: '#ad1457', icon: 'leisure' },
  stocks: { bg: '#e8f5e9', fg: '#2e7d32', icon: 'stocks' },
  loan: { bg: '#fff3e0', fg: '#ef6c00', icon: 'loan' },
  other: { bg: '#eceff1', fg: '#455a64', icon: 'box' },
}

export interface BillingPeriod {
  start: string
  end: string
}

/** 結算週期：每月 10 日到次月 9 日 */
export function billingPeriod(now: Date = new Date()): BillingPeriod {
  const y = now.getFullYear()
  let m = now.getMonth()
  if (now.getDate() < 10) m -= 1
  const start = new Date(y, m, 10)
  const end = new Date(y, m + 1, 9)
  return { start: toLocalISO(start), end: toLocalISO(end) }
}

/** 分組用的 key：內建類別用代碼，自訂類別用 "custom:名稱" */
export const categoryKey = (e: Pick<Expense, 'cat' | 'customCat'>): string =>
  e.cat === 'other' && e.customCat ? `custom:${e.customCat}` : e.cat

export function summarize(expenses: Expense[], period: BillingPeriod) {
  const byCategory = new Map<string, number>()
  let total = 0
  for (const e of expenses) {
    if (!e.date || e.date < period.start || e.date > period.end) continue
    total += e.amt
    const k = categoryKey(e)
    byCategory.set(k, (byCategory.get(k) ?? 0) + e.amt)
  }
  return { total, byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]) }
}

/** 數量 × 單價（取到小數第 2 位）；任一欄位空白或不是數字時回傳 null */
export function lineTotal(qty: string, unit: string): number | null {
  if (qty.trim() === '' || unit.trim() === '') return null
  const q = Number(qty)
  const u = Number(unit)
  if (!Number.isFinite(q) || !Number.isFinite(u) || q < 0 || u < 0) return null
  return Math.round(q * u * 100) / 100
}

/** 數量顯示：整數不帶小數點，沒有數量當作 1 */
export const formatQty = (q: number | undefined) => String(q ?? 1)
