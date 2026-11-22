import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { expenseCurrency } from '../core/expenses'
import { formatMoney } from '../core/format'
import { indexByDate, shoppingEntries, type ShoppingEntry } from '../core/shoppingAgenda'
import { useAppStore } from '../store/useAppStore'
import { useCurrency } from './useCurrency'

/** 購物連動行程的粉彩淺綠配色，跟一般行程（左側實線色條）做出區隔 */
export const SHOP_STYLE = { bg: '#eef9f2', border: '#bfe3cd', fg: '#2f7656', tagBg: '#d4efdf', dot: '#8fd0ab' }

/** 行事曆用：購物清單＋歸檔記帳依日期建好的索引。記帳一變，這裡就重新計算 */
export function useShoppingByDate() {
  const shopping = useAppStore((s) => s.shopping)
  const archives = useAppStore((s) => s.archives)
  return useMemo(() => indexByDate(shoppingEntries(shopping, archives)), [shopping, archives])
}

/** 這一筆用自己的幣別顯示金額；舊資料沒有幣別時用預設貨幣（跟購物清單一樣） */
export function useEntryMoney() {
  const { i18n } = useTranslation()
  const fallback = useCurrency()
  const lng = i18n.resolvedLanguage ?? 'zh-TW'
  return (x: ShoppingEntry) => formatMoney(x.expense.amt, lng, expenseCurrency(x.expense, fallback))
}

/** 「鳳梨 · 第五市場 · NT$150」：沒有商店就略過；金額 0（例如庫存加入的待買項目）不顯示 */
export function useShoppingLabel() {
  const money = useEntryMoney()
  return (x: ShoppingEntry) => [x.expense.title, x.expense.store, x.expense.amt ? money(x) : ''].filter(Boolean).join(' · ')
}
