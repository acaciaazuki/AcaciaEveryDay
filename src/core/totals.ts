/**
 * 多幣別小計：幣別 → 金額。不換算匯率，不同幣別絕不相加。
 * 訂閱頁與購物記帳共用。
 */
export type Totals = [currency: string, amount: number][]

/** 把金額加進某個幣別的小計 */
export function addTo(map: Map<string, number>, currency: string, amount: number) {
  map.set(currency, (map.get(currency) ?? 0) + amount)
}

const rank = (c: string, first: string) => (c === first ? 0 : /^[A-Z]{3}$/.test(c) ? 1 : 2)

/** 預設貨幣排第一，接著 ISO 幣別依代碼排序，最後是自訂符號；金額取到小數第 2 位，避免 0.1 + 0.2 的浮點誤差 */
export function toTotals(map: Map<string, number>, first: string): Totals {
  return [...map.entries()]
    .map(([c, n]): [string, number] => [c, Math.round(n * 100) / 100])
    .sort(([a], [b]) => rank(a, first) - rank(b, first) || a.localeCompare(b))
}

/** 合併多組小計（例如年度記帳本把每一期加起來） */
export function mergeTotals(list: Totals[], first: string): Totals {
  const map = new Map<string, number>()
  for (const totals of list) for (const [c, n] of totals) addTo(map, c, n)
  return toTotals(map, first)
}

/** 某個幣別的金額，沒有就是 0 */
export const amountIn = (totals: Totals, currency: string) => totals.find(([c]) => c === currency)?.[1] ?? 0
