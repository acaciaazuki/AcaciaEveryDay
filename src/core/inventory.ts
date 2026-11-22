import type { ExpenseCategory } from './categories'
import { addDays } from './date'
import type { IconName } from './icons'
import type { Expense, InvCategory, InventoryItem } from './schema'
import { addMonths, daysBetween } from './subscriptions'

/** 幾天內到期算「請汰換 / 即期」 */
export const DUE_SOON_DAYS = 7

export const INV_FILTERS = ['all', 'due', 'low', 'ok'] as const
export type InvFilter = (typeof INV_FILTERS)[number]

/** 分類的粉彩配色與圖示 */
export const INV_STYLE: Record<InvCategory, { bg: string; fg: string; icon: IconName }> = {
  personal: { bg: '#e0f2fe', fg: '#1565c0', icon: 'toothbrush' },
  home: { bg: '#e8f5e9', fg: '#2e7d32', icon: 'housing' },
  kitchen: { bg: '#fff3e0', fg: '#ef6c00', icon: 'meal' },
  health: { bg: '#ffebee', fg: '#c62828', icon: 'health' },
  skincare: { bg: '#fce4ec', fg: '#ad1457', icon: 'lotion' },
  stationery: { bg: '#f3e5f5', fg: '#6a1b9a', icon: 'pencil' },
  other: { bg: '#eceff1', fg: '#455a64', icon: 'box' },
}

/** 加入購物清單時，用品分類對應到記帳分類（日用品都歸「住」） */
export const INV_TO_EXPENSE: Record<InvCategory, ExpenseCategory> = {
  personal: 'housing',
  home: 'housing',
  kitchen: 'housing',
  health: 'other',
  skincare: 'housing',
  stationery: 'education',
  other: 'other',
}

export type DueKind = 'replace' | 'expiry' | 'pao'
export interface DueInfo {
  kind: DueKind
  date: string
  /** 負數代表已逾期幾天 */
  daysLeft: number
}

/** 下次該更換的日期：上次更換日 + 週期。沒設定就回傳空字串 */
export const nextReplace = (x: Pick<InventoryItem, 'lastReplaced' | 'cycleDays'>): string =>
  x.lastReplaced && x.cycleDays > 0 ? addDays(x.lastReplaced, x.cycleDays) : ''

/** 開封後期限：開封日 + PAO 月數 */
export const paoDate = (x: Pick<InventoryItem, 'openedDate' | 'paoMonths'>): string =>
  x.openedDate && x.paoMonths > 0 ? addMonths(x.openedDate, x.paoMonths) : ''

/** 這個用品所有要注意的日期（更換、未開封期限、開封後期限），由近到遠 */
export function dueDates(x: InventoryItem, todayISO: string): DueInfo[] {
  const list: [DueKind, string][] = [
    ['replace', nextReplace(x)],
    ['expiry', x.expiry],
    ['pao', paoDate(x)],
  ]
  return list
    .filter(([, d]) => d)
    .map(([kind, date]) => ({ kind, date, daysLeft: daysBetween(todayISO, date) }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

/** 最近的一個到期日；都沒設定時回傳 null */
export const nearestDue = (x: InventoryItem, todayISO: string): DueInfo | null => dueDates(x, todayISO)[0] ?? null

/** 7 天內到期或已逾期 */
export const isDue = (x: InventoryItem, todayISO: string) => {
  const d = nearestDue(x, todayISO)
  return d != null && d.daysLeft <= DUE_SOON_DAYS
}

/** 庫存低於安全庫存量就算待補貨；補到等於安全庫存就算足夠（安全庫存設 0 代表不提醒） */
export const isLow = (x: Pick<InventoryItem, 'stock' | 'minStock'>) => x.stock < x.minStock

/** 建議補貨數量：安全庫存 − 目前庫存，至少 1 */
export const restockQty = (x: Pick<InventoryItem, 'stock' | 'minStock'>) => Math.max(1, Math.ceil(x.minStock - x.stock))

/** 警示等級：已逾期（紅）、3 天內（橘）、7 天內（黃）、還早（綠） */
export type DueTone = 'overdue' | 'urgent' | 'soon' | 'ok'
export const dueTone = (daysLeft: number): DueTone => (daysLeft < 0 ? 'overdue' : daysLeft <= 3 ? 'urgent' : daysLeft <= DUE_SOON_DAYS ? 'soon' : 'ok')

export function matchesFilter(x: InventoryItem, f: InvFilter, todayISO: string): boolean {
  if (f === 'due') return isDue(x, todayISO)
  if (f === 'low') return isLow(x)
  if (f === 'ok') return !isLow(x)
  return true
}

/**
 * 跟購物清單的連動狀態：
 * - none：沒加過，或那一筆已被刪除／歸檔
 * - pending：已在購物清單中、還沒買
 * - bought：購物清單上已打勾（買到了），可以一鍵補進庫存
 */
export type ShoppingLink = { state: 'none' } | { state: 'pending' | 'bought'; expense: Expense }
export function shoppingLink(x: Pick<InventoryItem, 'shoppingId'>, shopping: Expense[]): ShoppingLink {
  if (!x.shoppingId) return { state: 'none' }
  const expense = shopping.find((e) => e.id === x.shoppingId)
  if (!expense) return { state: 'none' }
  return { state: expense.done ? 'bought' : 'pending', expense }
}

/** 名稱比對用：去頭尾空白、全形半形統一、不分大小寫 */
const normName = (s: string) => s.normalize('NFKC').trim().toLowerCase()

/** 這一筆購買記錄的數量；沒填或不合理時當 1 */
const expenseQty = (e: Pick<Expense, 'quantity'>) => (e.quantity && e.quantity > 0 ? e.quantity : 1)

/**
 * 購物清單上的這一筆是哪一個庫存用品：
 * 1. 從庫存頁加入的（用品記著這一筆的 shoppingId）
 * 2. 使用者自己在購物清單新增、名稱跟用品完全相同的（固定支出帶入的不算）
 */
export function inventoryFor(e: Expense, inventory: InventoryItem[]): InventoryItem | undefined {
  const linked = inventory.find((x) => x.shoppingId === e.id)
  if (linked) return linked
  if (e.recurringId) return undefined
  const name = normName(e.title)
  return name ? inventory.find((x) => normName(x.name) === name) : undefined
}

export interface StockChange {
  item: InventoryItem
  /** 正數是補進庫存，負數是取消打勾扣回 */
  qty: number
}

/**
 * 購物清單打勾／取消打勾時同步庫存（純函式，store 用它算新狀態）：
 * - 打勾且對得到用品、還沒入庫過：庫存加上購買數量，在這一筆記下 stockedItemId／stockedQty
 * - 取消打勾且之前自動入庫過：把那次加的數量扣回（最低 0），清掉記號，用品重新連回這一筆（顯示「已在購物清單」）
 * 同一筆反覆勾選、取消，庫存一定回到原本的數字，不會重複入庫
 */
export function toggleShoppingStock(
  shopping: Expense[],
  inventory: InventoryItem[],
  id: string,
): { shopping: Expense[]; inventory: InventoryItem[]; change?: StockChange } {
  const e = shopping.find((x) => x.id === id)
  if (!e) return { shopping, inventory }
  const done = !e.done
  const setExpense = (patch: Partial<Expense>) => shopping.map((x) => (x.id === id ? { ...x, ...patch } : x))

  if (done && !e.stockedItemId) {
    const item = inventoryFor(e, inventory)
    if (!item) return { shopping: setExpense({ done }), inventory }
    const qty = expenseQty(e)
    const next = { ...item, stock: item.stock + qty, shoppingId: item.shoppingId === id ? undefined : item.shoppingId }
    return {
      shopping: setExpense({ done, stockedItemId: item.id, stockedQty: qty }),
      inventory: inventory.map((x) => (x.id === item.id ? next : x)),
      change: { item: next, qty },
    }
  }

  if (!done && e.stockedItemId) {
    const item = inventory.find((x) => x.id === e.stockedItemId)
    const cleared = setExpense({ done, stockedItemId: undefined, stockedQty: undefined })
    if (!item) return { shopping: cleared, inventory }
    const qty = e.stockedQty ?? 0
    const next = { ...item, stock: Math.max(0, item.stock - qty), shoppingId: item.shoppingId ?? id }
    return { shopping: cleared, inventory: inventory.map((x) => (x.id === item.id ? next : x)), change: { item: next, qty: -qty } }
  }

  return { shopping: setExpense({ done }), inventory }
}

/** 稍後辦的庫存不足提醒：不另外存，每次依庫存與購物清單即時算出來 */
export interface LowStockReminder {
  item: InventoryItem
  /** 還差多少才補到安全庫存 */
  need: number
  /** 已在購物清單中（還沒買）的那一筆；沒有就是還沒安排採購 */
  pending?: Expense
}

export function lowStockReminders(inventory: InventoryItem[], shopping: Expense[]): LowStockReminder[] {
  const open = shopping.filter((e) => !e.done)
  return inventory
    .filter(isLow)
    .map((item) => ({
      item,
      need: restockQty(item),
      pending: (item.shoppingId && open.find((e) => e.id === item.shoppingId)) || open.find((e) => inventoryFor(e, inventory)?.id === item.id),
    }))
    .sort((a, b) => Number(!!a.pending) - Number(!!b.pending) || a.item.stock / (a.item.minStock || 1) - b.item.stock / (b.item.minStock || 1) || a.item.name.localeCompare(b.item.name))
}

/** 搜尋關鍵字：名稱、備註、分類名稱都比對，空白分隔的每個字都要命中 */
export function matchesQuery(x: InventoryItem, query: string, catLabel: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  const hay = [x.name, x.note, catLabel, x.unit].join(' ').toLowerCase()
  return tokens.every((tk) => hay.includes(tk))
}

/** 排序：已到期的在前，再來是待補貨，其他依最近到期日 */
export function sortInventory(items: InventoryItem[], todayISO: string): InventoryItem[] {
  const rank = (x: InventoryItem) => (isDue(x, todayISO) ? 0 : isLow(x) ? 1 : 2)
  const due = (x: InventoryItem) => nearestDue(x, todayISO)?.daysLeft ?? Number.POSITIVE_INFINITY
  return [...items].sort((a, b) => rank(a) - rank(b) || due(a) - due(b) || a.name.localeCompare(b.name))
}

export type SampleKey = 'sponge' | 'toothbrush' | 'tissue' | 'bodywash'

/**
 * 首次進入時帶入的 4 筆範例（日期相對今天，才看得到倒數與提醒）：
 * 洗碗海綿 4 天後該換＋待補貨、牙刷已逾期、衛生紙待補貨、沐浴乳開封後快到期
 */
export function sampleInventory(todayISO: string, label: (key: SampleKey, field: 'name' | 'unit') => string): Omit<InventoryItem, 'id'>[] {
  const base = { expiry: '', openedDate: '', paoMonths: 0, lastReplaced: '', cycleDays: 0, note: '' }
  const item = (key: SampleKey, rest: Partial<Omit<InventoryItem, 'id'>> & Pick<InventoryItem, 'cat' | 'stock' | 'minStock'>) => ({
    ...base,
    name: label(key, 'name'),
    unit: label(key, 'unit'),
    ...rest,
  })
  return [
    item('sponge', { cat: 'kitchen', stock: 1, minStock: 2, lastReplaced: addDays(todayISO, -26), cycleDays: 30 }),
    item('toothbrush', { cat: 'personal', stock: 3, minStock: 1, lastReplaced: addDays(todayISO, -95), cycleDays: 90 }),
    item('tissue', { cat: 'home', stock: 2, minStock: 4 }),
    item('bodywash', { cat: 'personal', stock: 2, minStock: 1, openedDate: addDays(addMonths(todayISO, -6), 3), paoMonths: 6, expiry: addMonths(todayISO, 18) }),
  ]
}
