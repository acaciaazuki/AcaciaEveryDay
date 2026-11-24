import { Icon } from '../components/AcaciaIcons'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/Button'
import { ColorSwatches, TextColorSwatches } from '../components/ColorSwatches'
import { Dialog } from '../components/Dialog'
import { Field } from '../components/Field'
import { TimeField } from '../components/TimeField'
import { CurrencyPicker } from '../components/CurrencyPicker'
import { IconSelect } from '../components/IconSelect'
import { LedgerBook } from '../components/LedgerBook'
import { PageHead } from '../components/PageHead'
import { RecurringFormDialog, RecurringImportDialog, RecurringListDialog } from '../components/RecurringDialogs'
import { Toast } from '../components/Toast'
import { TotalsText } from '../components/TotalsText'
import { EXPENSE_CATEGORIES } from '../core/categories'
import { toLocalISO } from '../core/date'
import { billingPeriod, expenseCurrency, formatQty, lineTotal, DEFAULT_BUDGET, EXPENSE_STYLE, summarize } from '../core/expenses'
import { currencyOptions, currencySymbol, CUSTOM_CURRENCY, formatMoney } from '../core/format'
import { useCurrency } from '../hooks/useCurrency'
import type { Expense, Recurring } from '../core/schema'
import { formatTime } from '../core/time'
import { useNow } from '../hooks/useNow'
import { useOpenFromUrl } from '../hooks/useOpenFromUrl'
import { useAppStore } from '../store/useAppStore'
import { CARD_FRAME, CARD_GRID } from '../components/cardGrid'

type Draft = Omit<Expense, 'id' | 'done'>
/** 固定支出的彈窗：批次帶入、範本清單、編輯範本（back 是存檔後回到哪一個） */
type RecurringView = 'import' | 'list' | { edit: Recurring | null; back: 'import' | 'list' }

export function ShoppingPage() {
  const { t, i18n } = useTranslation()
  const shopping = useAppStore((s) => s.shopping)
  const toggleExpense = useAppStore((s) => s.toggleExpense)
  const archives = useAppStore((s) => s.archives)
  const archiveShopping = useAppStore((s) => s.archiveShopping)
  const restoreArchive = useAppStore((s) => s.restoreArchive)
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [recView, setRecView] = useState<RecurringView | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  useOpenFromUrl(shopping, setEditing)
  // 搜尋結果是固定支出範本時，直接打開那個範本的編輯框
  const recurring = useAppStore((s) => s.recurring)
  const openRecurring = useCallback((r: Recurring) => setRecView({ edit: r, back: 'list' }), [])
  useOpenFromUrl(recurring, openRecurring, 'recurring')
  // 搜尋結果若是已歸檔的記帳，不開編輯框，改成在年度記帳本裡展開並標出那一筆
  const archived = useMemo(() => archives.flatMap((a) => a.expenses), [archives])
  useOpenFromUrl(archived, (e) => setFocusId(e.id))
  const lng = i18n.resolvedLanguage ?? 'zh-TW'
  const currency = useCurrency()
  // 每一筆用自己的幣別顯示；舊資料沒有幣別時用預設貨幣（跟以前一樣）
  const money = (n: number, cur: string) => formatMoney(n, lng, cur)

  const now = useNow()
  const period = billingPeriod(now)
  const todayISO = toLocalISO(now)
  // 週期結束後，上一期的記帳自動收進年度記帳本（沒有要歸檔的就什麼都不做）
  useEffect(() => {
    archiveShopping('ended', todayISO)
  }, [shopping, todayISO, archiveShopping])
  const inPeriod = shopping.filter((e) => e.date >= period.start && e.date <= period.end).length
  // 不同幣別分開小計、不相加；預算只跟預設貨幣的合計比較
  const { total, totals, byCategory } = summarize(shopping, period, currency)
  const hasForeign = totals.some(([c]) => c !== currency)
  const percent = Math.min((total / DEFAULT_BUDGET) * 100, 100)
  const over = total > DEFAULT_BUDGET
  const catLabel = (e: Pick<Expense, 'cat' | 'customCat'>) => (e.cat === 'other' && e.customCat ? e.customCat : t(`expenseCat.${e.cat}`))
  const keyLabel = (k: string) => (k.startsWith('custom:') ? k.slice(7) : t(`expenseCat.${k}`))

  return (
    <>
      <PageHead title={t('shopping.title')} actions={
          <>
            <Button variant="ghost" size="page" className="inline-flex items-center gap-1" onClick={() => setRecView('import')}>
              <Icon name="recurring" className="-my-1 size-[1.5em]" />
              {t('recurring.button')}
            </Button>
            <Button size="page" onClick={() => setEditing('new')}>{t('shopping.add')}</Button>
          </>
        }
      />

      <section className="mb-4 rounded-2xl border border-line bg-paper p-5 shadow-soft">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="mb-1 text-[length:calc(13px*var(--fs))] font-bold text-[#78867f]">{t('shopping.period', { start: period.start.slice(5).replace('-', '/'), end: period.end.slice(5).replace('-', '/') })}</h2>
            <p className={`flex flex-wrap items-baseline gap-x-1 gap-y-1 text-[length:calc(32px*var(--fs))] leading-none font-extrabold tracking-tight ${over ? 'text-[#ef4444]' : ''}`} data-testid="period-total">
              <TotalsText totals={totals} money={money} fallback={currency} />
            </p>
          </div>
          <div className="grid shrink-0 justify-items-end gap-2">
            <p className="text-right whitespace-nowrap text-[length:calc(11px*var(--fs))] text-[#9aa59f]">{t('shopping.budget', { percent: percent.toFixed(1) })}</p>
            <Button variant="ghost" disabled={inPeriod === 0} title={inPeriod === 0 ? t('shopping.archive.nothing') : undefined} onClick={() => setConfirmArchive(true)}>
              {t('shopping.archive.button')}
            </Button>
          </div>
        </div>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-[#f0f3f1]" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full transition-[width] duration-500 ${over ? 'bg-[#ef4444]' : 'bg-sage'}`} style={{ width: `${percent}%` }} />
        </div>
        {hasForeign && <p className="-mt-2 mb-3 text-[length:calc(11px*var(--fs))] text-[#9aa59f]">{t('shopping.budgetOnly', { sym: currencySymbol(currency, lng) })}</p>}
        <div className="flex flex-wrap gap-2">
          {byCategory.map(([k, v]) => (
            <span key={k} className="rounded-full border border-line bg-[#f9fbf9] px-3 py-1.5 text-[length:calc(11px*var(--fs))] font-semibold text-[#55645d]">
              {keyLabel(k)}:{' '}
              <span className="inline-flex flex-wrap gap-x-1">
                <TotalsText totals={v} money={money} fallback={currency} />
              </span>
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
          // 跟「庫存與提醒」的用品清單共用網格：手機 1 欄、一般筆電 2 欄、寬螢幕 3 欄
          <ul className={CARD_GRID} aria-label={t('shopping.list')}>
            {shopping.map((s) => {
              const st = EXPENSE_STYLE[s.cat]
              const cur = expenseCurrency(s, currency)
              const custom = s.bgColor && s.bgColor !== '#ffffff'
              // 舊資料預設的 #263633 視為沒設定，維持原本的分類配色
              const textColor = s.titleColor && s.titleColor !== '#263633' ? s.titleColor : st.fg
              return (
                <li
                  key={s.id}
                  className={`flex items-center justify-between gap-3 ${CARD_FRAME} ${s.done ? 'opacity-60 grayscale' : ''}`}
                  style={{ background: custom ? s.bgColor : st.bg, color: textColor, borderLeftColor: st.fg }}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <button
                      type="button"
                      aria-label={s.done ? t('shopping.markUndone') : t('shopping.markDone')}
                      onClick={() => {
                        // 對得到庫存用品時會自動補進（取消打勾則扣回）庫存，用提示告訴使用者
                        const c = toggleExpense(s.id)
                        if (!c) return
                        const unit = c.item.unit || t('inv.defaultUnit')
                        setToast(c.qty > 0 ? t('inv.toast.restocked', { name: c.item.name, count: c.qty, unit }) : t('inv.toast.unstocked', { name: c.item.name, count: -c.qty, unit }))
                      }}
                      className={`grid size-5 shrink-0 place-items-center rounded-full border-2 text-[length:calc(10px*var(--fs))] ${s.done ? 'border-[#888] bg-[#888] text-white' : 'border-current'}`}
                    >
                      {s.done && <Icon name="check" className="size-[1.3em]" />}
                    </button>
                    <button type="button" className="min-w-0 text-left" onClick={() => setEditing(s)}>
                      <strong className={`text-sm ${s.done ? 'line-through' : ''}`}>
                        {s.title}
                      </strong>
                      <small className="mt-1 block text-[length:calc(11px*var(--fs))] opacity-80">
                        {s.store || t('shopping.noStore')} · <Icon name={st.icon} className="size-[1.5em]" /> {catLabel(s)} · {s.date} {formatTime(s.time)}
                        {s.unitPrice != null && ` · ${formatQty(s.quantity)} × ${money(s.unitPrice, cur)}`}
                        {s.unitPrice == null && s.quantity != null && s.quantity !== 1 && ` · ${t('shopping.qtyOnly', { count: s.quantity })}`}
                        {s.recurringId && (
                          <>
                            {' · '}
                            <Icon name="recurring" className="size-[1.5em]" title={t('search.badge.recurring')} />
                          </>
                        )}
                        {s.note && ` · ${s.note}`}
                      </small>
                    </button>
                  </div>
                  <span className="shrink-0 font-bold">{money(s.amt, cur)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <LedgerBook archives={archives} lng={lng} currency={currency} currentStart={period.start} onRestore={restoreArchive} focusId={focusId} />

      <Dialog open={confirmArchive} onOpenChange={setConfirmArchive} title={t('shopping.archive.confirmTitle')}>
        <p className="mb-5 text-sm text-muted">{t('shopping.archive.confirmText', { start: period.start, end: period.end, count: inPeriod, year: period.start.slice(0, 4) })}</p>
        <div className="flex gap-2">
          <Button variant="ghost" className="ml-auto" onClick={() => setConfirmArchive(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => {
              archiveShopping('current', todayISO)
              setConfirmArchive(false)
            }}
          >
            {t('shopping.archive.confirm')}
          </Button>
        </div>
      </Dialog>

      {recView === 'import' && (
        <RecurringImportDialog
          period={period}
          todayISO={todayISO}
          onManage={() => setRecView('list')}
          onAdd={() => setRecView({ edit: null, back: 'import' })}
          onClose={() => setRecView(null)}
          onImported={(count, completed) =>
            count > 0 && setToast([t('recurring.imported', { count }), ...completed.map((name) => t('recurring.completed', { name }))].join(' '))
          }
        />
      )}
      {recView === 'list' && <RecurringListDialog onEdit={(r) => setRecView({ edit: r, back: 'list' })} onBack={() => setRecView('import')} onClose={() => setRecView(null)} />}
      {recView && typeof recView === 'object' && <RecurringFormDialog key={recView.edit?.id ?? 'new'} item={recView.edit} onDone={() => setRecView(recView.back)} />}
      {toast && <Toast message={toast} onDone={clearToast} />}

      {editing && <ExpenseDialog key={editing === 'new' ? 'new' : editing.id} expense={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function ExpenseDialog({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const defaultCurrency = useCurrency()
  const shopping = useAppStore((s) => s.shopping)
  const archives = useAppStore((s) => s.archives)
  // 選單裡除了常用幣別，也列出曾經用過的其他幣別與自訂符號，方便旅遊時連續記同一種外幣
  const options = useMemo(
    () => currencyOptions([...shopping, ...archives.flatMap((a) => a.expenses)].map((e) => e.currency ?? '')),
    [shopping, archives],
  )
  // 新增時帶入設定頁的預設貨幣；舊資料沒有幣別，也當作預設貨幣（跟原本顯示的一樣）
  const [curChoice, setCurChoice] = useState(expense ? expenseCurrency(expense, defaultCurrency) : defaultCurrency)
  const [customSym, setCustomSym] = useState('')
  const cur = curChoice === CUSTOM_CURRENCY ? customSym.trim() : curChoice
  // 輸入框旁的幣別標籤跟著這一筆選的幣別
  const sym = cur ? currencySymbol(cur, i18n.resolvedLanguage ?? 'zh-TW') : '?'
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
    if (!cur) return setError(t('currency.customRequired'))
    const customCat = draft.cat === 'other' ? draft.customCat?.trim() || undefined : undefined
    const quantity = Number(qty)
    const unitPrice = unit.trim() === '' ? undefined : Number(unit)
    const data = {
      ...draft,
      title,
      store: draft.store.trim(),
      note: draft.note?.trim() || undefined,
      amt: Number(amt) || 0,
      customCat,
      currency: cur,
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
          <Field label={t('common.withCurrency', { label: t('shopping.form.unit'), sym })} type="number" inputMode="decimal" min={0} step="any" placeholder="0" value={unit} onChange={(e) => onQtyUnit(qty, e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t('common.withCurrency', { label: t('shopping.form.amt'), sym })}
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
          <CurrencyPicker value={curChoice} custom={customSym} options={options} onChange={setCurChoice} onCustomChange={setCustomSym} />
          <p className="col-span-full -mt-1.5 text-[length:calc(11px*var(--fs))] text-muted">{t('shopping.form.amtHint')}</p>
        </div>
        <Field label={t('shopping.form.store')} placeholder={t('shopping.form.storePlaceholder')} value={draft.store} onChange={(e) => set({ store: e.target.value })} />
        <Field label={t('shopping.form.note')} placeholder={t('shopping.form.notePlaceholder')} value={draft.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
        <IconSelect
          label={t('shopping.form.cat')}
          value={draft.cat}
          options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(`expenseCat.${c}`), icon: EXPENSE_STYLE[c].icon, bg: EXPENSE_STYLE[c].bg }))}
          onChange={(cat) => set({ cat })}
        />
        {draft.cat === 'other' && (
          <Field label={t('shopping.form.customCat')} placeholder={t('shopping.form.customCatPlaceholder')} value={draft.customCat ?? ''} onChange={(e) => set({ customCat: e.target.value })} />
        )}
        <div className="grid gap-3 min-[30rem]:grid-cols-2">
          <Field label={t('shopping.form.date')} type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
          <TimeField optional label={t('shopping.form.time')} value={draft.time} onChange={(time) => set({ time })} />
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
