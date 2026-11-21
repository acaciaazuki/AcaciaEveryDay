import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/Button'
import { ColorSwatches, TextColorSwatches } from '../components/ColorSwatches'
import { Dialog } from '../components/Dialog'
import { Field } from '../components/Field'
import { PageHead } from '../components/PageHead'
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '../core/categories'
import { toLocalISO } from '../core/date'
import { billingPeriod, formatQty, lineTotal, DEFAULT_BUDGET, EXPENSE_STYLE, summarize } from '../core/expenses'
import { formatMoney } from '../core/format'
import type { Expense } from '../core/schema'
import { useNow } from '../hooks/useNow'
import { useOpenFromUrl } from '../hooks/useOpenFromUrl'
import { useAppStore } from '../store/useAppStore'

type Draft = Omit<Expense, 'id' | 'done'>

export function ShoppingPage() {
  const { t, i18n } = useTranslation()
  const shopping = useAppStore((s) => s.shopping)
  const toggleExpense = useAppStore((s) => s.toggleExpense)
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)
  useOpenFromUrl(shopping, setEditing)
  const lng = i18n.resolvedLanguage ?? 'zh-TW'

  const period = billingPeriod(useNow())
  const { total, byCategory } = summarize(shopping, period)
  const percent = Math.min((total / DEFAULT_BUDGET) * 100, 100)
  const over = total > DEFAULT_BUDGET
  const catLabel = (e: Pick<Expense, 'cat' | 'customCat'>) => (e.cat === 'other' && e.customCat ? e.customCat : t(`expenseCat.${e.cat}`))
  const keyLabel = (k: string) => (k.startsWith('custom:') ? k.slice(7) : t(`expenseCat.${k}`))

  return (
    <>
      <PageHead eyebrow={t('shopping.eyebrow')} title={t('shopping.title')} actions={<Button onClick={() => setEditing('new')}>{t('shopping.add')}</Button>} />

      <section className="mb-4 rounded-2xl border border-line bg-paper p-5 shadow-soft">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="mb-1 text-[length:calc(13px*var(--fs))] font-bold text-[#78867f]">{t('shopping.period', { start: period.start.slice(5).replace('-', '/'), end: period.end.slice(5).replace('-', '/') })}</h2>
            <p className={`text-[length:calc(32px*var(--fs))] leading-none font-extrabold tracking-tight ${over ? 'text-[#ef4444]' : ''}`}>{formatMoney(total, lng)}</p>
          </div>
          <p className="text-right text-[length:calc(11px*var(--fs))] text-[#9aa59f]">{t('shopping.budget', { percent: percent.toFixed(1) })}</p>
        </div>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-[#f0f3f1]" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full transition-[width] duration-500 ${over ? 'bg-[#ef4444]' : 'bg-sage'}`} style={{ width: `${percent}%` }} />
        </div>
        <div className="flex flex-wrap gap-2">
          {byCategory.map(([k, v]) => (
            <span key={k} className="rounded-full border border-line bg-[#f9fbf9] px-3 py-1.5 text-[length:calc(11px*var(--fs))] font-semibold text-[#55645d]">
              {keyLabel(k)}: {formatMoney(v, lng)}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-(--radius-card) bg-paper p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{t('shopping.list')}</h2>
          <span className="text-xs text-muted">{t('shopping.count', { count: shopping.length })}</span>
        </div>
        {shopping.length === 0 ? (
          <p className="py-4 text-center text-muted">{t('shopping.empty')}</p>
        ) : (
          <ul className="grid gap-2.5">
            {shopping.map((s) => {
              const st = EXPENSE_STYLE[s.cat]
              const custom = s.bgColor && s.bgColor !== '#ffffff'
              // 舊資料預設的 #263633 視為沒設定，維持原本的分類配色
              const textColor = s.titleColor && s.titleColor !== '#263633' ? s.titleColor : st.fg
              return (
                <li
                  key={s.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border border-l-4 border-line p-3 transition hover:-translate-y-px ${s.done ? 'opacity-60 grayscale' : ''}`}
                  style={{ background: custom ? s.bgColor : st.bg, color: textColor, borderLeftColor: st.fg }}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <button
                      type="button"
                      aria-label={s.done ? t('shopping.markUndone') : t('shopping.markDone')}
                      onClick={() => toggleExpense(s.id)}
                      className={`grid size-5 shrink-0 place-items-center rounded-full border-2 text-[length:calc(10px*var(--fs))] ${s.done ? 'border-[#888] bg-[#888] text-white' : 'border-current'}`}
                    >
                      {s.done && '✓'}
                    </button>
                    <button type="button" className="min-w-0 text-left" onClick={() => setEditing(s)}>
                      <strong className={`text-sm ${s.done ? 'line-through' : ''}`}>
                        {s.title}
                      </strong>
                      <small className="mt-1 block text-[length:calc(11px*var(--fs))] opacity-80">
                        {s.store || t('shopping.noStore')} · {st.icon} {catLabel(s)} · {s.date} {s.time}
                        {s.unitPrice != null && ` · ${formatQty(s.quantity)} × ${formatMoney(s.unitPrice, lng)}`}
                      </small>
                    </button>
                  </div>
                  <span className="shrink-0 font-bold">{formatMoney(s.amt, lng)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {editing && <ExpenseDialog key={editing === 'new' ? 'new' : editing.id} expense={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function ExpenseDialog({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const { t } = useTranslation()
  const addExpense = useAppStore((s) => s.addExpense)
  const updateExpense = useAppStore((s) => s.updateExpense)
  const removeExpense = useAppStore((s) => s.removeExpense)
  const [draft, setDraft] = useState<Draft>(
    expense ?? { title: '', amt: 0, store: '', cat: 'food', customCat: '', date: toLocalISO(), time: '12:00', bgColor: '#ffffff' },
  )
  // 數量、單價、總金額都用字串存，輸入時才不會被數字格式打斷
  const [qty, setQty] = useState(expense?.quantity != null ? String(expense.quantity) : '1')
  const [unit, setUnit] = useState(expense?.unitPrice != null ? String(expense.unitPrice) : '')
  const [amt, setAmt] = useState(expense ? String(expense.amt) : '')
  // 改數量或單價時自動算出總金額；單價是空的就不動總金額
  const onQtyUnit = (nextQty: string, nextUnit: string) => {
    setQty(nextQty)
    setUnit(nextUnit)
    const total = lineTotal(nextQty, nextUnit)
    if (total != null) setAmt(String(total))
  }
  const [error, setError] = useState('')
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const title = draft.title.trim()
    if (!title) return setError(t('shopping.form.titleRequired'))
    const customCat = draft.cat === 'other' ? draft.customCat?.trim() || undefined : undefined
    const quantity = Number(qty)
    const unitPrice = unit.trim() === '' ? undefined : Number(unit)
    const data = {
      ...draft,
      title,
      store: draft.store.trim(),
      amt: Number(amt) || 0,
      customCat,
      // 有填單價才記錄數量與單價，沒填就維持舊格式
      unitPrice: unitPrice != null && Number.isFinite(unitPrice) ? unitPrice : undefined,
      quantity: unitPrice != null && Number.isFinite(unitPrice) && quantity > 0 ? quantity : undefined,
    }
    if (expense) updateExpense(expense.id, data)
    else addExpense(data)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={expense ? t('shopping.form.editTitle') : t('shopping.form.newTitle')}>
      <form onSubmit={submit} className="grid gap-4">
        <Field label={t('shopping.form.title')} placeholder={t('shopping.form.titlePlaceholder')} value={draft.title} onChange={(e) => set({ title: e.target.value })} autoFocus />
        {error && <p className="-mt-2 text-xs text-[#c2583d]">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('shopping.form.qty')} type="number" inputMode="decimal" min={0} step="any" value={qty} onChange={(e) => onQtyUnit(e.target.value, unit)} />
          <Field label={t('shopping.form.unit')} type="number" inputMode="decimal" min={0} step="any" placeholder="0" value={unit} onChange={(e) => onQtyUnit(qty, e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t('shopping.form.amt')}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="0"
            value={amt}
            onChange={(e) => {
              // 直接改總金額：單價不再成立，清掉讓兩邊不會互相覆蓋
              setAmt(e.target.value)
              setUnit('')
            }}
          />
          <Field label={t('shopping.form.store')} placeholder={t('shopping.form.storePlaceholder')} value={draft.store} onChange={(e) => set({ store: e.target.value })} />
        </div>
        <label className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('shopping.form.cat')}
          <select
            className="rounded-(--radius-control) border border-line bg-oat px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-sage"
            value={draft.cat}
            onChange={(e) => set({ cat: e.target.value as ExpenseCategory })}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_STYLE[c].icon} {t(`expenseCat.${c}`)}
              </option>
            ))}
          </select>
        </label>
        {draft.cat === 'other' && (
          <Field label={t('shopping.form.customCat')} placeholder={t('shopping.form.customCatPlaceholder')} value={draft.customCat ?? ''} onChange={(e) => set({ customCat: e.target.value })} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('shopping.form.date')} type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
          <Field label={t('shopping.form.time')} type="time" value={draft.time} onChange={(e) => set({ time: e.target.value })} />
        </div>
        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('shopping.form.color')}
          <ColorSwatches label={t('shopping.form.color')} value={draft.bgColor} onChange={(c) => set({ bgColor: c.bg })} />
        </div>
        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('shopping.form.textColor')}
          <TextColorSwatches label={t('shopping.form.textColor')} value={draft.titleColor} onChange={(c) => set({ titleColor: c })} />
        </div>
        <div className="rounded-(--radius-control) border border-line px-4 py-3 text-sm font-bold" style={{ background: draft.bgColor || '#fff', color: draft.titleColor || undefined }}>
          {draft.title.trim() || t('shopping.form.preview')}
        </div>
        <div className="mt-2 flex gap-2">
          {expense && (
            <Button
              variant="danger"
              onClick={() => {
                removeExpense(expense.id)
                onClose()
              }}
            >
              {t('common.delete')}
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit">{t('common.save')}</Button>
        </div>
      </form>
    </Dialog>
  )
}
