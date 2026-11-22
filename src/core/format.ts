import { DEFAULT_CURRENCY } from './schema'

/** 沒有小數位的幣別 */
const WHOLE = new Set(['TWD', 'JPY', 'KRW'])

/** 依幣別顯示金額。整數不顯示 .00；不認得的幣別代碼退回「USD 12」格式 */
export function formatCurrency(n: number, currency: string, lng: string): string {
  try {
    const text = new Intl.NumberFormat(lng, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: WHOLE.has(currency) ? 0 : 2 }).format(n)
    // 繁中語系的新台幣只顯示「$」，跟美金放在一起會分不清，補成 NT$
    return currency === 'TWD' && text.startsWith('$') ? `NT${text}` : text
  } catch {
    return `${currency} ${n}`
  }
}

/** 記帳等沒有個別幣別的金額：以設定頁的「預設貨幣」顯示（只換符號，不換算匯率） */
export const formatMoney = (n: number, lng: string, currency: string = DEFAULT_CURRENCY) => formatCurrency(n, currency, lng)

/** 幣別符號（NT$、US$、¥、€…），給輸入框旁的幣別標籤用；取不到就回傳幣別代碼 */
export function currencySymbol(currency: string, lng: string): string {
  try {
    const sym = new Intl.NumberFormat(lng, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency
    return currency === 'TWD' && sym === '$' ? 'NT$' : sym
  } catch {
    return currency
  }
}

/** 幣別的在地名稱（新台幣、US Dollar、日本円…），瀏覽器不支援時回傳代碼 */
export function currencyName(currency: string, lng: string): string {
  try {
    return new Intl.DisplayNames(lng, { type: 'currency' }).of(currency) ?? currency
  } catch {
    return currency
  }
}
