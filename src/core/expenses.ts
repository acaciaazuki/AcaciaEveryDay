import type { ExpenseCategory } from './categories'
import type { IconName } from './icons'
import { toLocalISO } from './date'
import { DEFAULT_CURRENCY, type Expense } from './schema'
import { addTo, amountIn, toTotals, type Totals } from './totals'

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
  insurance: { bg: '#e0f2f1', fg: '#00695c', icon: 'insurance' },
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

/**
 * 這一筆的貨幣。舊資料沒有 currency 欄位，當作「設定頁目前的預設貨幣」：
 * 加這個欄位之前，所有記帳都是用預設貨幣顯示，這樣舊資料的畫面不會有任何改變。
 */
export const expenseCurrency = (e: Pick<Expense, 'currency'>, fallback: string = DEFAULT_CURRENCY) => e.currency || fallback

export interface ExpenseSummary {
  /** 預設貨幣的合計，給預算進度條用（預算只跟預設貨幣比，外幣不換算） */
  total: number
  /** 各幣別小計，預設貨幣排第一 */
  totals: Totals
  /** 各類別的各幣別小計，依預設貨幣金額由大到小，再依外幣金額 */
  byCategory: [key: string, totals: Totals][]
}

/** 週期內的記帳依幣別分開加總；金額 0 的項目（只是購物清單）不會多出一個「NT$0」的幣別 */
export function summarize(expenses: Expense[], period: BillingPeriod, fallback: string = DEFAULT_CURRENCY): ExpenseSummary {
  const all = new Map<string, number>()
  const cats = new Map<string, Map<string, number>>()
  for (const e of expenses) {
    if (!e.date || e.date < period.start || e.date > period.end || !e.amt) continue
    const cur = expenseCurrency(e, fallback)
    addTo(all, cur, e.amt)
    const k = categoryKey(e)
    if (!cats.has(k)) cats.set(k, new Map())
    addTo(cats.get(k)!, cur, e.amt)
  }
  const totals = toTotals(all, fallback)
  const rest = (t: Totals) => t.reduce((n, [c, v]) => (c === fallback ? n : n + v), 0)
  const byCategory = [...cats.entries()]
    .map(([k, m]): [string, Totals] => [k, toTotals(m, fallback)])
    .sort((a, b) => amountIn(b[1], fallback) - amountIn(a[1], fallback) || rest(b[1]) - rest(a[1]))
  return { total: amountIn(totals, fallback), totals, byCategory }
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
