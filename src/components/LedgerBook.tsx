import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ledgerYears } from '../core/archive'
import { EXPENSE_STYLE, summarize } from '../core/expenses'
import { formatMoney } from '../core/format'
import type { Archive, Expense } from '../core/schema'
import { Button } from './Button'

/** 年度記帳本：依年份切換，底下列出每個已結算週期的總額、分類與明細 */
export function LedgerBook({ archives, lng, currentStart, onRestore }: { archives: Archive[]; lng: string; currentStart: string; onRestore: (start: string) => void }) {
  const { t } = useTranslation()
  const years = ledgerYears(archives)
  const [picked, setPicked] = useState<string | null>(null)
  const active = years.find((y) => y.year === picked) ?? years[0]

  const catLabel = (e: Pick<Expense, 'cat' | 'customCat'>) => (e.cat === 'other' && e.customCat ? e.customCat : t(`expenseCat.${e.cat}`))
  const keyLabel = (k: string) => (k.startsWith('custom:') ? k.slice(7) : t(`expenseCat.${k}`))

  return (
    <section className="mt-4 rounded-(--radius-card) bg-paper p-5 shadow-card" aria-labelledby="ledger-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="ledger-title" className="font-bold">
          {t('shopping.ledger.title')}
        </h2>
        {years.length > 0 && (
          <div role="group" aria-label={t('shopping.ledger.year')} className="flex flex-wrap rounded-full bg-oat p-0.5">
            {years.map((y) => (
              <button
                key={y.year}
                type="button"
                aria-pressed={active?.year === y.year}
                onClick={() => setPicked(y.year)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${active?.year === y.year ? 'bg-paper text-sage-dark shadow-soft' : 'text-muted hover:text-ink'}`}
              >
                {y.year}
              </button>
            ))}
          </div>
        )}
      </div>

      {!active ? (
        <p className="py-4 text-center text-muted">{t('shopping.ledger.empty')}</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold">{t('shopping.ledger.yearBook', { year: active.year })}</h3>
            <span className="text-xs text-muted">
              {t('shopping.ledger.yearSummary', { periods: active.periods.length, total: formatMoney(active.periods.reduce((n, p) => n + summarize(p.expenses, p).total, 0), lng) })}
            </span>
          </div>
          <ul className="grid gap-2.5">
            {active.periods.map((p) => {
              const { total, byCategory } = summarize(p.expenses, p)
              return (
                <li key={p.start} className="rounded-xl border border-line">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3">
                      <span className="text-[length:calc(13px*var(--fs))] font-bold">{t('shopping.ledger.range', { start: p.start, end: p.end })}</span>
                      <span className="flex items-center gap-3 text-xs text-muted">
                        {t('shopping.count', { count: p.expenses.length })}
                        <b className="text-sm text-ink">{formatMoney(total, lng)}</b>
                      </span>
                    </summary>
                    <div className="border-t border-line p-3">
                      <div className="mb-3 flex flex-wrap gap-2">
                        {byCategory.map(([k, v]) => (
                          <span key={k} className="rounded-full border border-line bg-[#f9fbf9] px-3 py-1.5 text-[length:calc(11px*var(--fs))] font-semibold text-[#55645d]">
                            {keyLabel(k)}: {formatMoney(v, lng)}
                          </span>
                        ))}
                      </div>
                      <ul className="grid gap-1.5">
                        {[...p.expenses]
                          .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
                          .map((e) => (
                            <li key={e.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[length:calc(13px*var(--fs))]" style={{ background: e.bgColor && e.bgColor !== '#ffffff' ? e.bgColor : EXPENSE_STYLE[e.cat].bg, color: e.titleColor && e.titleColor !== '#263633' ? e.titleColor : EXPENSE_STYLE[e.cat].fg }}>
                              <span className="min-w-0">
                                <strong>{e.title}</strong>
                                <small className="block text-[length:calc(11px*var(--fs))] opacity-80">
                                  {e.date} · {EXPENSE_STYLE[e.cat].icon} {catLabel(e)}
                                  {e.unitPrice != null && ` · ${e.quantity ?? 1} × ${formatMoney(e.unitPrice, lng)}`}
                                </small>
                              </span>
                              <span className="shrink-0 font-bold">{formatMoney(e.amt, lng)}</span>
                            </li>
                          ))}
                      </ul>
                      {p.start === currentStart && (
                        <Button variant="ghost" className="mt-3" onClick={() => onRestore(p.start)}>
                          {t('shopping.ledger.restore')}
                        </Button>
                      )}
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
