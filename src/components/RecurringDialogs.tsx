import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { EXPENSE_CATEGORIES } from '../core/categories'
import { EXPENSE_STYLE } from '../core/expenses'
import { currencyOptions, currencySymbol, CUSTOM_CURRENCY, formatMoney } from '../core/format'
import { BATCH_MONTHS_MAX, batchMonthsOf, importedKeys, planImport, progressOf, type PlannedMonth } from '../core/recurring'
import type { BillingPeriod } from '../core/expenses'
import type { Recurring } from '../core/schema'
import { useCurrency } from '../hooks/useCurrency'
import { useAppStore, type RecurringInput } from '../store/useAppStore'
import { Icon } from './AcaciaIcons'
import { Button } from './Button'
import { CurrencyPicker } from './CurrencyPicker'
import { Dialog } from './Dialog'
import { Field } from './Field'
import { IconSelect } from './IconSelect'

const catLabelOf = (t: (k: string) => string, r: Pick<Recurring, 'cat' | 'customCat'>) => (r.cat === 'other' && r.customCat ? r.customCat : t(`expenseCat.${r.cat}`))
const pill = 'inline-flex items-center rounded-full px-2 py-0.5 text-[length:calc(10px*var(--fs))] font-bold'

/** 這次會產生的期數範圍，例如「本次第 3–5 期」 */
const rangeOf = (plan: PlannedMonth[]) => {
  const nums = plan.map((m) => m.installment).filter((n): n is number => n != null)
  return nums.length ? { from: nums[0]!, to: nums[nums.length - 1]! } : null
}

interface Row {
  checked: boolean
  amount: string
  note: string
}

/**
 * 批次把固定支出帶入本期：預設勾選本期還沒加入的項目，可先微調金額與備註。
 * 本期已加入的項目（範本 id＋週期開始日比對）會標示且不能再勾。
 */
export function RecurringImportDialog({
  period,
  todayISO,
  onManage,
  onAdd,
  onClose,
  onImported,
}: {
  period: BillingPeriod
  todayISO: string
  onManage: () => void
  onAdd: () => void
  onClose: () => void
  onImported: (count: number, completed: string[]) => void
}) {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage ?? 'zh-TW'
  const recurring = useAppStore((s) => s.recurring)
  const shopping = useAppStore((s) => s.shopping)
  const archives = useAppStore((s) => s.archives)
  const importRecurring = useAppStore((s) => s.importRecurring)
  const active = recurring.filter((r) => !r.done)
  const keys = useMemo(() => importedKeys(shopping, archives), [shopping, archives])
  // 每個範本這次會產生哪些月份（依批次月數，略過已加入的月份）；空的代表都加過了
  const plans = useMemo(() => new Map(active.map((r) => [r.id, planImport(r, period, keys)])), [active, period, keys])
  const planOf = (r: Recurring) => plans.get(r.id) ?? []
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(active.map((r) => [r.id, { checked: planOf(r).length > 0, amount: String(r.amount), note: r.note }])),
  )
  const row = (r: Recurring): Row => rows[r.id] ?? { checked: false, amount: String(r.amount), note: r.note }
  const setRow = (id: string, patch: Partial<Row>) => setRows((all) => ({ ...all, [id]: { ...(all[id] ?? { checked: false, amount: '', note: '' }), ...patch } }))
  const available = active.filter((r) => planOf(r).length > 0)
  const picked = available.filter((r) => row(r).checked)
  const recordCount = picked.reduce((n, r) => n + planOf(r).length, 0)
  const allChecked = available.length > 0 && picked.length === available.length

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const { count, completed } = importRecurring(
      picked.map((r) => ({ id: r.id, amount: Number(row(r).amount) || 0, note: row(r).note })),
      todayISO,
    )
    onImported(count, completed)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('recurring.importTitle')}>
      {active.length === 0 ? (
        <div className="grid gap-4">
          <p className="text-sm text-muted">{t('recurring.empty')}</p>
          <div className="flex gap-2">
            <Button variant="ghost" className="ml-auto" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onAdd}>{t('recurring.add')}</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          <p className="-mt-1 text-[length:calc(12px*var(--fs))] text-muted">{t('recurring.importHint', { start: period.start, end: period.end })}</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              disabled={available.length === 0}
              onClick={() => setRows((all) => ({ ...all, ...Object.fromEntries(available.map((r) => [r.id, { ...row(r), checked: !allChecked }])) }))}
            >
              {allChecked ? t('recurring.selectNone') : t('recurring.selectAll')}
            </Button>
            <Button variant="ghost" onClick={onManage}>
              {t('recurring.manage')}
            </Button>
          </div>
          {available.length === 0 && <p className="rounded-xl bg-sage-light px-3 py-2 text-[length:calc(12px*var(--fs))] text-sage-dark">{t('recurring.allAdded')}</p>}
          <ul className="grid gap-2.5">
            {active.map((r) => {
              const st = EXPENSE_STYLE[r.cat]
              const plan = planOf(r)
              const added = plan.length === 0
              const months = batchMonthsOf(r)
              const v = row(r)
              const prog = progressOf(r)
              const range = rangeOf(plan)
              const sym = currencySymbol(r.currency, lng)
              return (
                <li key={r.id} className={`rounded-xl border border-l-4 border-line p-3 ${added ? 'opacity-60' : ''}`} style={{ background: st.bg, borderLeftColor: st.fg }}>
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 accent-sage"
                      checked={!added && v.checked}
                      disabled={added}
                      onChange={(e) => setRow(r.id, { checked: e.target.checked })}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <strong className="text-sm" style={{ color: st.fg }}>
                          {r.name}
                        </strong>
                        {prog && <span className={`${pill} bg-paper text-[#55645d]`}>{t('recurring.progress', prog)}</span>}
                        {months > 1 && <span className={`${pill} bg-paper text-[#55645d]`}>{t('recurring.batchPill', { count: months })}</span>}
                        {added && <span className={`${pill} bg-sage text-white`}>{t(months > 1 ? 'recurring.addedBatch' : 'recurring.added')}</span>}
                      </span>
                      <small className="mt-0.5 block text-[length:calc(11px*var(--fs))] text-[#55645d]">
                        <Icon name={st.icon} className="size-[1.5em]" /> {catLabelOf(t, r)} · {t('recurring.dayLabel', { day: r.day })}
                        {(added || !v.checked) && ` · ${formatMoney(r.amount, lng, r.currency)}`}
                      </small>
                      {!added && (
                        <small className="mt-1 block text-[length:calc(11px*var(--fs))] text-sage-dark" data-testid={`plan-${r.id}`}>
                          {plan.length === 1 ? t('recurring.due', { date: plan[0]!.date }) : t('recurring.dueMany', { count: plan.length, dates: plan.map((m) => m.date.slice(5).replace('-', '/')).join('、') })}
                          {range && ` · ${range.from === range.to ? t('recurring.willAddOne', { n: range.from }) : t('recurring.willAddRange', range)}`}
                          {range && prog && range.to === prog.total && ` · ${t('recurring.willFinish')}`}
                        </small>
                      )}
                    </span>
                  </label>
                  {!added && v.checked && (
                    <div className="mt-2.5 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 pl-6.5">
                      <Field
                        label={t('common.withCurrency', { label: t(plan.length > 1 ? 'recurring.amountEach' : 'recurring.amount'), sym })}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={v.amount}
                        onChange={(e) => setRow(r.id, { amount: e.target.value })}
                      />
                      <Field label={t('recurring.note')} placeholder={t('recurring.notePlaceholder')} value={v.note} onChange={(e) => setRow(r.id, { note: e.target.value })} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="flex gap-2">
            <Button variant="ghost" className="ml-auto" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={recordCount === 0}>
              {t('recurring.confirm', { count: recordCount })}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

/** 固定支出範本庫：列出所有範本（已完成的排在後面），點一筆編輯 */
export function RecurringListDialog({ onEdit, onBack, onClose }: { onEdit: (r: Recurring | null) => void; onBack: () => void; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage ?? 'zh-TW'
  const recurring = useAppStore((s) => s.recurring)
  const sorted = [...recurring].sort((a, b) => Number(a.done) - Number(b.done) || a.day - b.day)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('recurring.listTitle')}>
      <div className="grid gap-4">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted">{t('recurring.empty')}</p>
        ) : (
          <ul className="grid gap-2">
            {sorted.map((r) => {
              const st = EXPENSE_STYLE[r.cat]
              const prog = progressOf(r)
              const months = batchMonthsOf(r)
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onEdit(r)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border border-l-4 border-line p-3 text-left transition hover:-translate-y-px ${r.done ? 'opacity-60 grayscale' : ''}`}
                    style={{ background: st.bg, color: st.fg, borderLeftColor: st.fg }}
                  >
                    <span className="min-w-0">
                      <strong className="text-sm">{r.name}</strong>
                      <small className="mt-0.5 block text-[length:calc(11px*var(--fs))] opacity-80">
                        <Icon name={st.icon} className="size-[1.5em]" /> {catLabelOf(t, r)} · {t('recurring.dayLabel', { day: r.day })}
                        {months > 1 && ` · ${t('recurring.batchPill', { count: months })}`}
                        {prog && ` · ${t('recurring.progress', prog)}`}
                        {r.done && ` · ${t(prog && prog.paid >= prog.total ? 'recurring.paidOff' : 'recurring.done')}`}
                      </small>
                    </span>
                    <span className="shrink-0 font-bold">{formatMoney(r.amount, lng, r.currency)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={onBack}>
            {t('recurring.back')}
          </Button>
          <Button className="ml-auto" onClick={() => onEdit(null)}>
            {t('recurring.add')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

/** 新增／編輯一個固定支出範本 */
export function RecurringFormDialog({ item, onDone }: { item: Recurring | null; onDone: () => void }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage ?? 'zh-TW'
  const defaultCurrency = useCurrency()
  const recurring = useAppStore((s) => s.recurring)
  const shopping = useAppStore((s) => s.shopping)
  const addRecurring = useAppStore((s) => s.addRecurring)
  const updateRecurring = useAppStore((s) => s.updateRecurring)
  const removeRecurring = useAppStore((s) => s.removeRecurring)
  const options = useMemo(() => currencyOptions([...recurring.map((r) => r.currency), ...shopping.map((e) => e.currency ?? '')]), [recurring, shopping])
  const [curChoice, setCurChoice] = useState(item?.currency ?? defaultCurrency)
  const [customSym, setCustomSym] = useState('')
  const cur = curChoice === CUSTOM_CURRENCY ? customSym.trim() : curChoice
  const sym = cur ? currencySymbol(cur, lng) : '?'
  const [name, setName] = useState(item?.name ?? '')
  const [cat, setCat] = useState<Recurring['cat']>(item?.cat ?? 'housing')
  const [customCat, setCustomCat] = useState(item?.customCat ?? '')
  const [amount, setAmount] = useState(item ? String(item.amount) : '')
  const [day, setDay] = useState(String(item?.day ?? 10))
  const [note, setNote] = useState(item?.note ?? '')
  const [hasInst, setHasInst] = useState(Boolean(item?.installments))
  const [total, setTotal] = useState(String(item?.installments?.total ?? 6))
  // 表單上填「已付到第幾期」（0 起），存回去是 next = 已付 + 1
  const [paid, setPaid] = useState(String(item?.installments ? item.installments.next - 1 : 0))
  const [months, setMonths] = useState(String(item ? batchMonthsOf(item) : 1))
  const [done, setDone] = useState(item?.done ?? false)
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setError(t('recurring.form.nameRequired'))
    if (!cur) return setError(t('currency.customRequired'))
    const d = Number(day)
    if (!Number.isInteger(d) || d < 1 || d > 31) return setError(t('recurring.form.dayInvalid'))
    const bm = Number(months)
    if (!Number.isInteger(bm) || bm < 1 || bm > BATCH_MONTHS_MAX) return setError(t('recurring.form.batchInvalid', { max: BATCH_MONTHS_MAX }))
    const tot = Number(total)
    const pd = Number(paid)
    if (hasInst && (!Number.isInteger(tot) || tot < 1)) return setError(t('recurring.form.totalInvalid'))
    // 已付到第幾期可以是 0（還沒開始付）到總期數（已付清）
    if (hasInst && (!Number.isInteger(pd) || pd < 0 || pd > tot)) return setError(t('recurring.form.paidInvalid'))
    const nx = pd + 1
    const data: RecurringInput = {
      name: n,
      cat,
      customCat: cat === 'other' ? customCat.trim() || undefined : undefined,
      amount: Math.max(0, Number(amount) || 0),
      currency: cur,
      day: d,
      batchMonths: bm,
      note: note.trim(),
      installments: hasInst ? { total: tot, next: nx } : undefined,
      // 分期已經全部帶入完就算完成；手動勾選也可以
      done: done || (hasInst && nx > tot),
    }
    if (item) updateRecurring(item.id, data)
    else addRecurring(data)
    onDone()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onDone()} title={item ? t('recurring.form.editTitle') : t('recurring.form.newTitle')}>
      <form onSubmit={submit} className="grid gap-4">
        <Field label={t('recurring.form.name')} placeholder={t('recurring.form.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        {error && <p className="-mt-2 text-xs text-[#c2583d]">{error}</p>}
        <IconSelect
          label={t('shopping.form.cat')}
          value={cat}
          options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(`expenseCat.${c}`), icon: EXPENSE_STYLE[c].icon, bg: EXPENSE_STYLE[c].bg }))}
          onChange={setCat}
        />
        {cat === 'other' && <Field label={t('shopping.form.customCat')} placeholder={t('shopping.form.customCatPlaceholder')} value={customCat} onChange={(e) => setCustomCat(e.target.value)} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('common.withCurrency', { label: t('recurring.form.amount'), sym })} type="number" inputMode="decimal" min={0} step="any" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <CurrencyPicker value={curChoice} custom={customSym} options={options} onChange={setCurChoice} onCustomChange={setCustomSym} />
        </div>
        <div className="grid gap-1.5">
          <Field label={t('recurring.form.day')} type="number" inputMode="numeric" min={1} max={31} step={1} value={day} onChange={(e) => setDay(e.target.value)} />
          <p className="text-[length:calc(11px*var(--fs))] text-muted">{t('recurring.form.dayHint')}</p>
        </div>
        <div className="grid gap-1.5">
          <Field
            label={t('recurring.form.batchMonths')}
            type="number"
            inputMode="numeric"
            min={1}
            max={BATCH_MONTHS_MAX}
            step={1}
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
          <p className="text-[length:calc(11px*var(--fs))] text-muted">{t('recurring.form.batchHint', { max: BATCH_MONTHS_MAX })}</p>
        </div>
        <Field label={t('recurring.form.note')} placeholder={t('recurring.form.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
        <fieldset className="grid gap-3 rounded-xl border border-line p-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="size-4 accent-sage" checked={hasInst} onChange={(e) => setHasInst(e.target.checked)} />
            {t('recurring.form.installments')}
          </label>
          {hasInst && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('recurring.form.total')} type="number" inputMode="numeric" min={1} step={1} value={total} onChange={(e) => setTotal(e.target.value)} />
                <Field label={t('recurring.form.paid')} type="number" inputMode="numeric" min={0} max={Number(total) || undefined} step={1} value={paid} onChange={(e) => setPaid(e.target.value)} />
              </div>
              <InstallmentStatus total={total} paid={paid} />
              <p className="text-[length:calc(11px*var(--fs))] text-muted">{t('recurring.form.installmentHint')}</p>
            </>
          )}
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-sage" checked={done} onChange={(e) => setDone(e.target.checked)} />
          {t('recurring.form.done')}
        </label>
        <div className="mt-2 flex gap-2">
          {item && (
            <Button
              variant="danger"
              onClick={() => {
                removeRecurring(item.id)
                onDone()
              }}
            >
              {t('common.delete')}
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onDone}>
            {t('common.cancel')}
          </Button>
          <Button type="submit">{t('common.save')}</Button>
        </div>
      </form>
    </Dialog>
  )
}

/** 表單裡即時顯示的分期進度；填錯時不顯示（送出時再提示），付清時提醒會標記完成 */
function InstallmentStatus({ total, paid }: { total: string; paid: string }) {
  const { t } = useTranslation()
  const tot = Number(total)
  const pd = Number(paid)
  if (!Number.isInteger(tot) || tot < 1 || !Number.isInteger(pd) || pd < 0 || pd > tot) return null
  const left = tot - pd
  return (
    <p className="rounded-xl bg-sage-light px-3 py-2 text-[length:calc(12px*var(--fs))] text-sage-dark" data-testid="installment-status">
      {t('recurring.progress', { paid: pd, total: tot })} · {left === 0 ? t('recurring.form.paidOffHint') : t('recurring.form.leftHint', { count: left })}
    </p>
  )
}
