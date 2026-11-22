/** 金額一律以新台幣顯示，依語系調整千分位 */
export const formatMoney = (n: number, lng: string) =>
  new Intl.NumberFormat(lng, { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

/** 沒有小數位的幣別 */
const WHOLE = new Set(['TWD', 'JPY', 'KRW'])

/** 依幣別顯示金額（訂閱與續費用）。整數不顯示 .00；不認得的幣別代碼退回「USD 12」格式 */
export function formatCurrency(n: number, currency: string, lng: string): string {
  try {
    const text = new Intl.NumberFormat(lng, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: WHOLE.has(currency) ? 0 : 2 }).format(n)
    // 繁中語系的新台幣只顯示「$」，跟美金放在一起會分不清，補成 NT$
    return currency === 'TWD' && text.startsWith('$') ? `NT${text}` : text
  } catch {
    return `${currency} ${n}`
  }
}
