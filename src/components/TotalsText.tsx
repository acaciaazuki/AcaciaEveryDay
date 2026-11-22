import type { Totals } from '../core/totals'

/** 多種幣別不換算匯率，分開顯示：NT$1,300 + US$20。沒有任何金額時顯示 fallback 幣別的 0 */
export function TotalsText({ totals, money, fallback, sep = '+' }: { totals: Totals; money: (n: number, cur: string) => string; fallback: string; sep?: string }) {
  if (totals.length === 0) return <>{money(0, fallback)}</>
  return (
    <>
      {totals.map(([cur, n], i) => (
        <span key={cur} className="whitespace-nowrap">
          {i > 0 && <span className="mr-1 text-muted">{sep}</span>}
          {money(Math.round(n * 100) / 100, cur)}
        </span>
      ))}
    </>
  )
}
