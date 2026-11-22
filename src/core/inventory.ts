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

/** 庫存 ≤ 安全庫存量就算待補貨 */
export const isLow = (x: Pick<InventoryItem, 'stock' | 'minStock'>) => x.stock <= x.minStock

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
