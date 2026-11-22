import { useEffect, useId, useState, type FormEvent, type ReactNode, type SelectHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, IconBadge } from '../components/AcaciaIcons'
import { Button } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { Field } from '../components/Field'
import { IconSelect } from '../components/IconSelect'
import { PageHead } from '../components/PageHead'
import { TotalsText } from '../components/TotalsText'
import { toLocalISO } from '../core/date'
import { currencySymbol, formatCurrency } from '../core/format'
import { useCurrency } from '../hooks/useCurrency'
import type { IconName } from '../core/icons'
import { SUB_CATEGORIES, SUB_CURRENCIES, SUB_CYCLES, SUB_STATUSES, type SubStatus, type Subscription } from '../core/schema'
import {
  CYCLE_MONTHS,
  monthTotals,
  nextCharge,
  sampleSubscriptions,
  SUB_STYLE,
  upcoming,
  UPCOMING_WINDOWS,
  yearlyTotals,
  type UpcomingWindow,
} from '../core/subscriptions'
import { useNow } from '../hooks/useNow'
import { useOpenFromUrl } from '../hooks/useOpenFromUrl'
import { useAppStore, type SubscriptionInput } from '../store/useAppStore'

type Filter = 'all' | SubStatus
const FILTERS: Filter[] = ['all', ...SUB_STATUSES]
const STATUS_ORDER: Record<SubStatus, number> = { active: 0, paused: 1, cancelled: 2 }
const STATUS_STYLE: Record<SubStatus, string> = {
  active: 'bg-sage-light text-sage-dark',
  paused: 'bg-weekend text-[#7a6232]',
  cancelled: 'bg-[#f1f4f2] text-[#8c9993]',
}

const card = 'rounded-(--radius-card) bg-paper p-5 shadow-card'
const segBtn = (on: boolean) => `rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap transition ${on ? 'bg-paper text-sage-dark shadow-soft' : 'text-muted hover:text-ink'}`

export function SubscriptionsPage() {
  const { t, i18n } = useTranslation()
  const subs = useAppStore((s) => s.subscriptions)
  const seeded = useAppStore((s) => s.subscriptionsSeeded)
  const seedSubscriptions = useAppStore((s) => s.seedSubscriptions)
  const addSubscription = useAppStore((s) => s.addSubscription)
  const updateSubscription = useAppStore((s) => s.updateSubscription)
  const [editing, setEditing] = useState<Subscription | 'new' | null>(null)
  const [windowDays, setWindowDays] = useState<UpcomingWindow>(30)
  const [filter, setFilter] = useState<Filter>('all')
  const currency = useCurrency()
  useOpenFromUrl(subs, setEditing)

  const lng = i18n.resolvedLanguage ?? 'zh-TW'
  const todayISO = toLocalISO(useNow())

  // 第一次進入、清單還是空的：帶入範例，直接看得到版面
  useEffect(() => {
    if (!seeded && subs.length === 0) seedSubscriptions(sampleSubscriptions(todayISO, t('subs.samplePayment')))
  }, [seeded, subs.length, seedSubscriptions, todayISO, t])

  const money = (n: number, cur: string) => formatCurrency(n, cur, lng)
  const soon = upcoming(subs, todayISO, windowDays)
  const active = subs.filter((s) => s.status === 'active')
  const sorted = [...subs].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (nextCharge(a, todayISO) || '9999').localeCompare(nextCharge(b, todayISO) || '9999') ||
      a.name.localeCompare(b.name),
  )
  const shown = filter === 'all' ? sorted : sorted.filter((s) => s.status === filter)
  const countOf = (f: Filter) => (f === 'all' ? subs.length : subs.filter((s) => s.status === f).length)
  const dueLabel = (days: number) => (days === 0 ? t('subs.soon.today') : days === 1 ? t('subs.soon.tomorrow') : t('subs.soon.inDays', { count: days }))
  const dateLabel = (iso: string) => new Intl.DateTimeFormat(lng, { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date(`${iso}T00:00`))

  const loadSamples = () => {
    for (const s of sampleSubscriptions(todayISO, t('subs.samplePayment'))) addSubscription(s)
  }

  return (
    <>
      <PageHead eyebrow={t('subs.eyebrow')} title={t('subs.title')} actions={<Button onClick={() => setEditing('new')}>{t('subs.add')}</Button>} />

      {/* A. 本月帳單控制台 */}
      <section className="mb-5 rounded-(--radius-card) bg-linear-to-br from-mint to-sage-light p-6">
        <h2 className="mb-1.5 text-lg font-extrabold">{t('subs.board.title')}</h2>
        <p className="mb-4 text-[length:calc(13px*var(--fs))] text-[#55645d]">{t('subs.board.text')}</p>
        <div className="grid grid-cols-2 gap-3 min-[1001px]:grid-cols-4">
          <Stat icon="card" bg="#cfe4f6" label={t('subs.board.month')} value={<TotalsText totals={monthTotals(subs, todayISO, currency)} money={money} fallback={currency} />} />
          <Stat icon="calendar" bg="#dff2e9" label={t('subs.board.year')} value={<TotalsText totals={yearlyTotals(subs, currency)} money={money} fallback={currency} />} />
          <Stat icon="clock" bg="#fff1c1" label={t('subs.board.upcoming', { days: windowDays })} value={t('subs.board.upcomingUnit', { count: soon.length })} />
          <Stat icon="subscription" bg="#fbe0f5" label={t('subs.board.active')} value={t('subs.board.activeUnit', { count: active.length })} />
        </div>
      </section>

      <div className="grid gap-5 min-[1001px]:grid-cols-[360px_1fr]">
        {/* B. 即將扣款提醒 */}
        <section className={`${card} content-start`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 font-bold">
              <Icon name="reminders" className="text-[#5f7a70]" />
              {t('subs.soon.title')}
            </h2>
            <div role="group" aria-label={t('subs.soon.window')} className="flex rounded-full bg-oat p-0.5">
              {UPCOMING_WINDOWS.map((d) => (
                <button key={d} type="button" aria-pressed={windowDays === d} onClick={() => setWindowDays(d)} className={segBtn(windowDays === d)}>
                  {t('subs.soon.days', { days: d })}
                </button>
              ))}
            </div>
          </div>
          {soon.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line py-8 text-center text-[length:calc(13px*var(--fs))] text-muted">{t('subs.soon.empty', { days: windowDays })}</p>
          ) : (
            <ul className="grid gap-2.5" aria-label={t('subs.soon.title')}>
              {soon.map(({ sub, date, daysLeft }) => {
                const urgent = daysLeft <= 3
                return (
                  <li key={sub.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(sub)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-px ${urgent ? 'border-[#f3e3b0] bg-weekend' : 'border-line bg-oat'}`}
                    >
                      <IconBadge name={SUB_STYLE[sub.cat].icon} bg={SUB_STYLE[sub.cat].bg} />
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{sub.name}</strong>
                        <small className="block text-[length:calc(11px*var(--fs))] text-muted">{dateLabel(date)}</small>
                      </span>
                      <span className="grid shrink-0 justify-items-end gap-1">
                        <b className="text-sm">{money(sub.amount, sub.currency)}</b>
                        <span className={`rounded-full px-2 py-0.5 text-[length:calc(10px*var(--fs))] font-bold ${urgent ? 'bg-paper text-[#b4532a]' : 'bg-sage-light text-sage-dark'}`}>{dueLabel(daysLeft)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* C. 訂閱清單 */}
        <section className={card}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">{t('subs.list.title')}</h2>
            <span className="text-xs text-muted">{t('subs.list.count', { count: subs.length })}</span>
          </div>
          <div role="group" aria-label={t('subs.list.filter')} className="mb-4 flex w-fit flex-wrap rounded-full bg-oat p-0.5">
            {FILTERS.map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={segBtn(filter === f)}>
                {f === 'all' ? t('subs.list.all') : t(`subs.status.${f}`)}
                <span className="ml-1 opacity-60">{countOf(f)}</span>
              </button>
            ))}
          </div>

          {subs.length === 0 ? (
            <div className="grid justify-items-center gap-3 py-6 text-center text-muted">
              <p>{t('subs.list.empty')}</p>
              <Button variant="ghost" onClick={loadSamples}>
                {t('subs.list.loadSamples')}
              </Button>
            </div>
          ) : (
            <ul className="grid gap-2.5">
              {shown.map((s) => {
                const st = SUB_STYLE[s.cat]
                const next = nextCharge(s, todayISO)
                return (
                  <li
                    key={s.id}
                    className={`flex items-center gap-3 rounded-xl border border-l-4 border-line bg-paper p-3 transition hover:-translate-y-px ${s.status === 'active' ? '' : 'opacity-60'}`}
                    style={{ borderLeftColor: st.fg }}
                  >
                    <IconBadge name={st.icon} bg={st.bg} />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(s)}>
                      <strong className={`flex flex-wrap items-center gap-1.5 text-sm ${s.status === 'cancelled' ? 'line-through' : ''}`}>
                        {s.name}
                        {s.plan && <span className="rounded-md bg-mint px-1.5 py-0.5 text-[length:calc(10px*var(--fs))] font-bold text-sage-dark no-underline">{s.plan}</span>}
                      </strong>
                      <small className="mt-1 block text-[length:calc(11px*var(--fs))] text-muted">
                        {[t(`subs.cat.${s.cat}`), t(`subs.cycle.${s.cycle}`), s.payment, next ? t('subs.list.next', { date: next }) : t('subs.list.noDate')].filter(Boolean).join(' · ')}
                      </small>
                    </button>
                    <div className="grid shrink-0 justify-items-end gap-1">
                      <span className="text-sm font-bold">
                        {money(s.amount, s.currency)}
                        <small className="ml-0.5 font-semibold text-muted">{t(`subs.cycleShort.${s.cycle}`)}</small>
                      </span>
                      {s.cycle !== 'yearly' && <small className="text-[length:calc(10px*var(--fs))] text-muted">{t('subs.list.perYear', { amount: money((s.amount * 12) / CYCLE_MONTHS[s.cycle], s.currency) })}</small>}
                      <select
                        aria-label={`${t('subs.form.status')}：${s.name}`}
                        value={s.status}
                        onChange={(e) => updateSubscription(s.id, { status: e.target.value as SubStatus })}
                        className={`cursor-pointer rounded-full border-0 px-2 py-0.5 text-[length:calc(10px*var(--fs))] font-bold outline-none ${STATUS_STYLE[s.status]}`}
                      >
                        {SUB_STATUSES.map((x) => (
                          <option key={x} value={x}>
                            {t(`subs.status.${x}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {editing && (
        <SubscriptionDialog key={editing === 'new' ? 'new' : editing.id} sub={editing === 'new' ? null : editing} todayISO={todayISO} onClose={() => setEditing(null)} />
      )}
    </>
  )
}

function Stat({ icon, bg, label, value }: { icon: IconName; bg: string; label: string; value: ReactNode }) {
  return (
    <div className="grid content-start gap-2 rounded-(--radius-card) bg-paper/85 p-4 shadow-soft">
      <span className="flex items-center gap-2 text-[length:calc(12px*var(--fs))] font-semibold text-[#55645d]">
        <IconBadge name={icon} bg={bg} />
        {label}
      </span>
      <span className="flex flex-wrap items-baseline gap-x-1 text-[length:calc(17px*var(--fs))] leading-tight font-extrabold tracking-tight min-[681px]:text-[length:calc(20px*var(--fs))]">{value}</span>
    </div>
  )
}

function Select({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted">
      {label}
      <select className="w-full min-w-0 rounded-(--radius-control) border border-line bg-oat px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-sage" {...props}>
        {children}
      </select>
    </label>
  )
}

function Segmented<V extends string>({ label, value, options, onChange }: { label: string; value: V; options: readonly { value: V; label: string }[]; onChange: (v: V) => void }) {
  return (
    <div className="grid gap-1.5 text-xs font-semibold text-muted">
      <span>{label}</span>
      <div role="radiogroup" aria-label={label} className="flex w-fit flex-wrap rounded-full bg-oat p-0.5">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={segBtn(value === o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SubscriptionDialog({ sub, todayISO, onClose }: { sub: Subscription | null; todayISO: string; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage ?? 'zh-TW'
  const defaultCurrency = useCurrency()
  const addSubscription = useAppStore((s) => s.addSubscription)
  const updateSubscription = useAppStore((s) => s.updateSubscription)
  const removeSubscription = useAppStore((s) => s.removeSubscription)
  const uid = useId()
  // 編輯時，扣款日直接顯示「下一次」：已經過去的日期自動推到下一期
  const [draft, setDraft] = useState<SubscriptionInput>(() =>
    sub
      ? { ...sub, nextDate: nextCharge(sub, todayISO) || sub.nextDate }
      : // 新增時預先帶入設定頁的預設貨幣；編輯既有訂閱則保留它原本的幣別
        { name: '', plan: '', cat: 'tools', cycle: 'monthly', amount: 0, currency: defaultCurrency, nextDate: todayISO, payment: '', status: 'active', note: '' },
  )
  const [amount, setAmount] = useState(sub ? String(sub.amount) : '')
  const [error, setError] = useState('')
  const set = (patch: Partial<SubscriptionInput>) => setDraft((d) => ({ ...d, ...patch }))
  const currencies = SUB_CURRENCIES.includes(draft.currency as (typeof SUB_CURRENCIES)[number]) ? SUB_CURRENCIES : [draft.currency, ...SUB_CURRENCIES]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const name = draft.name.trim()
    if (!name) return setError(t('subs.form.nameRequired'))
    const data = { ...draft, name, plan: draft.plan.trim(), payment: draft.payment.trim(), note: draft.note.trim(), amount: Math.max(0, Number(amount) || 0) }
    if (sub) updateSubscription(sub.id, data)
    else addSubscription(data)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={sub ? t('subs.form.editTitle') : t('subs.form.newTitle')}>
      <form onSubmit={submit} className="grid gap-4">
        <Field label={t('subs.form.name')} placeholder={t('subs.form.namePlaceholder')} value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
        {error && <p className="-mt-2 text-xs text-[#c2583d]">{error}</p>}
        <Field label={t('subs.form.plan')} placeholder={t('subs.form.planPlaceholder')} list={`${uid}-plan`} value={draft.plan} onChange={(e) => set({ plan: e.target.value })} />
        <datalist id={`${uid}-plan`}>
          {t('subs.planSuggest').split('|').map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <IconSelect
          label={t('subs.form.cat')}
          value={draft.cat}
          options={SUB_CATEGORIES.map((c) => ({ value: c, label: t(`subs.cat.${c}`), icon: SUB_STYLE[c].icon, bg: SUB_STYLE[c].bg }))}
          onChange={(cat) => set({ cat })}
        />
        <Segmented label={t('subs.form.cycle')} value={draft.cycle} options={SUB_CYCLES.map((c) => ({ value: c, label: t(`subs.cycle.${c}`) }))} onChange={(cycle) => set({ cycle })} />
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Field label={t('common.withCurrency', { label: t('subs.form.amount'), sym: currencySymbol(draft.currency, lng) })} type="number" inputMode="decimal" min={0} step="any" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Select label={t('subs.form.currency')} value={draft.currency} onChange={(e) => set({ currency: e.target.value })}>
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c} {currencySymbol(c, lng) !== c ? currencySymbol(c, lng) : ''}
              </option>
            ))}
          </Select>
        </div>
        <Field label={t('subs.form.nextDate')} type="date" value={draft.nextDate} onChange={(e) => set({ nextDate: e.target.value })} />
        <Field label={t('subs.form.payment')} placeholder={t('subs.form.paymentPlaceholder')} list={`${uid}-pay`} value={draft.payment} onChange={(e) => set({ payment: e.target.value })} />
        <datalist id={`${uid}-pay`}>
          {t('subs.paymentSuggest').split('|').map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <Segmented label={t('subs.form.status')} value={draft.status} options={SUB_STATUSES.map((s) => ({ value: s, label: t(`subs.status.${s}`) }))} onChange={(status) => set({ status })} />
        <Field label={t('subs.form.note')} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
        <div className="mt-2 flex gap-2">
          {sub && (
            <Button
              variant="danger"
              onClick={() => {
                if (!window.confirm(t('subs.form.deleteConfirm', { name: sub.name }))) return
                removeSubscription(sub.id)
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
