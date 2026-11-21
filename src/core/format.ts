/** 金額一律以新台幣顯示，依語系調整千分位 */
export const formatMoney = (n: number, lng: string) =>
  new Intl.NumberFormat(lng, { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)
