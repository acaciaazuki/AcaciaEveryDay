import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, IconBadge } from '../components/AcaciaIcons'
import { Button } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { Field } from '../components/Field'
import { IconSelect } from '../components/IconSelect'
import { CustomCatEditor, InvCategoryDialog } from '../components/InvCategoryManager'
import { PageHead } from '../components/PageHead'
import { Toast } from '../components/Toast'
import { toLocalISO } from '../core/date'
import type { IconName } from '../core/icons'
import {
  dueDates,
  dueTone,
  INV_FILTERS,
  isDue,
  isLow,
  matchesFilter,
  matchesQuery,
  restockQty,
  sampleInventory,
  shoppingLink,
  sortInventory,
  type DueInfo,
  type DueTone,
  type InvFilter,
  type SampleKey,
} from '../core/inventory'
import { isCustomInvCat } from '../core/invCategories'
import type { InventoryItem } from '../core/schema'
import { daysBetween } from '../core/subscriptions'
import { useInvCategories } from '../hooks/useInvCategories'
import { useNow } from '../hooks/useNow'
import { useOpenFromUrl } from '../hooks/useOpenFromUrl'
import { useAppStore, type InventoryInput } from '../store/useAppStore'

const card = 'rounded-(--radius-card) bg-paper p-5 shadow-card'
const segBtn = (on: boolean) => `rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap transition ${on ? 'bg-paper text-sage-dark shadow-soft' : 'text-muted hover:text-ink'}`
const badge = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[length:calc(10px*var(--fs))] font-bold whitespace-nowrap'

/** 警示標籤配色：紅＝逾期、橘＝3 天內、黃＝7 天內、藍＝還早、紫＝待補貨、綠＝庫存充足 */
const TONE: Record<DueTone | 'low' | 'enough', string> = {
  overdue: 'bg-[#fde2e1] text-[#b83a2e]',
  urgent: 'bg-[#ffe6d1] text-[#b4532a]',
  soon: 'bg-weekend text-[#7a6232]',
  ok: 'bg-[#e0f2fe] text-[#1d6fa5]',
  low: 'bg-[#efe6fb] text-[#6b3fa0]',
  enough: 'bg-sage-light text-sage-dark',
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export function InventoryPage() {
  const { t, i18n } = useTranslation()
  const items = useAppStore((s) => s.inventory)
  const shopping = useAppStore((s) => s.shopping)
  const seeded = useAppStore((s) => s.inventorySeeded)
  const seedInventory = useAppStore((s) => s.seedInventory)
  const addInventory = useAppStore((s) => s.addInventory)
  const [editing, setEditing] = useState<InventoryItem | 'new' | null>(null)
  const [filter, setFilter] = useState<InvFilter>('all')
  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [managing, setManaging] = useState(false)
  const cats = useInvCategories()
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  useOpenFromUrl(items, setEditing)

  const lng = i18n.resolvedLanguage ?? 'zh-TW'
  const now = useNow()
  const todayISO = toLocalISO(now)
  const samples = () => sampleInventory(todayISO, (k: SampleKey, f) => t(`inv.sample.${k}.${f}`))

  // 第一次進入、清單還是空的：帶入範例，直接看得到週期計算與補貨提示
  useEffect(() => {
    if (!seeded && items.length === 0) seedInventory(sampleInventory(todayISO, (k: SampleKey, f) => t(`inv.sample.${k}.${f}`)))
  }, [seeded, items.length, seedInventory, todayISO, t])

  const catLabel = (x: InventoryItem) => cats.labelOf(x.cat)
  // 分類篩選：依使用者排序，只列出有用品的分類；選的分類被刪掉或清空時回到全部
  const catCounts = new Map<string, number>()
  for (const x of items) {
    const k = cats.of(x.cat).key
    catCounts.set(k, (catCounts.get(k) ?? 0) + 1)
  }
  const catChips = cats.list.filter((c) => catCounts.has(c.key))
  const activeCat = catFilter !== 'all' && catCounts.has(catFilter) ? catFilter : 'all'
  const dueCount = items.filter((x) => isDue(x, todayISO)).length
  const lowCount = items.filter(isLow).length
  const countOf = (f: InvFilter) => items.filter((x) => matchesFilter(x, f, todayISO)).length
  const shown = sortInventory(items, todayISO).filter((x) => matchesFilter(x, filter, todayISO) && (activeCat === 'all' || cats.of(x.cat).key === activeCat) && matchesQuery(x, query, catLabel(x)))
  const dateLabel = (iso: string) => new Intl.DateTimeFormat(lng, { month: 'short', day: 'numeric' }).format(new Date(`${iso}T00:00`))

  return (
    <>
      <PageHead eyebrow={t('inv.eyebrow')} title={t('inv.title')} actions={<Button onClick={() => setEditing('new')}>{t('inv.add')}</Button>} />

      {/* A. 狀態總覽 */}
      <section className="mb-5 rounded-(--radius-card) bg-linear-to-br from-mint to-sage-light p-6">
        <h2 className="mb-1.5 text-lg font-extrabold">{t('inv.board.title')}</h2>
        <p className="mb-4 text-[length:calc(13px*var(--fs))] text-[#55645d]">{t('inv.board.text')}</p>
        <div className="grid grid-cols-1 gap-3 min-[481px]:grid-cols-3">
          <Stat icon="clock" bg="#ffe6d1" label={t('inv.board.due')} value={t('inv.board.unit', { count: dueCount })} onClick={() => setFilter('due')} alert={dueCount > 0} />
          <Stat icon="shopping" bg="#efe6fb" label={t('inv.board.low')} value={t('inv.board.unit', { count: lowCount })} onClick={() => setFilter('low')} alert={lowCount > 0} />
          <Stat icon="inventory" bg="#dff2e9" label={t('inv.board.total')} value={t('inv.board.unit', { count: items.length })} onClick={() => setFilter('all')} />
        </div>
      </section>

      {/* B. 用品清單 */}
      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">{t('inv.list.title')}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{t('inv.list.count', { count: items.length })}</span>
            <Button variant="ghost" className="inline-flex items-center gap-1 px-3! py-1.5!" onClick={() => setManaging(true)}>
              <Icon name="tag" className="size-[1.3em]" />
              {t('inv.cats.manage')}
            </Button>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div role="group" aria-label={t('inv.list.filter')} className="flex w-fit flex-wrap rounded-full bg-oat p-0.5">
            {INV_FILTERS.map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={segBtn(filter === f)}>
                {t(`inv.filter.${f}`)}
                <span className="ml-1 opacity-60">{countOf(f)}</span>
              </button>
            ))}
          </div>
          <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-full border border-line bg-oat px-3 py-1.5 focus-within:border-sage">
            <Icon name="search" className="text-sage" />
            <input
              type="search"
              aria-label={t('inv.list.search')}
              placeholder={t('inv.list.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
        </div>

        {catChips.length > 1 && (
          <div role="group" aria-label={t('inv.list.catFilter')} className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <button type="button" aria-pressed={activeCat === 'all'} onClick={() => setCatFilter('all')} className={catChip(activeCat === 'all')}>
              {t('inv.list.allCats')}
            </button>
            {catChips.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={activeCat === c.key}
                onClick={() => setCatFilter(c.key)}
                className={catChip(activeCat === c.key)}
                style={activeCat === c.key ? { background: c.bg, color: c.fg, borderColor: c.fg } : undefined}
              >
                <Icon name={c.icon} className="size-[1.3em]" />
                {c.label}
                <span className="opacity-60">{catCounts.get(c.key)}</span>
              </button>
            ))}
          </div>
        )}

        {items.length === 0 ? (
          <div className="grid justify-items-center gap-3 py-6 text-center text-muted">
            <p>{t('inv.list.empty')}</p>
            <Button variant="ghost" onClick={() => samples().forEach((s) => addInventory(s))}>
              {t('inv.list.loadSamples')}
            </Button>
          </div>
        ) : shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line py-8 text-center text-[length:calc(13px*var(--fs))] text-muted">{t('inv.list.noMatch')}</p>
        ) : (
          <ul className="grid gap-3 min-[1001px]:grid-cols-2" aria-label={t('inv.list.title')}>
            {shown.map((x) => (
              <ItemCard key={x.id} item={x} todayISO={todayISO} time={hhmm(now)} link={shoppingLink(x, shopping)} dateLabel={dateLabel} onEdit={() => setEditing(x)} onToast={setToast} />
            ))}
          </ul>
        )}
      </section>

      {editing && <ItemDialog key={editing === 'new' ? 'new' : editing.id} item={editing === 'new' ? null : editing} todayISO={todayISO} onClose={() => setEditing(null)} />}
      {managing && <InvCategoryDialog onClose={() => setManaging(false)} />}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </>
  )
}

const catChip = (on: boolean) =>
  `inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold whitespace-nowrap transition ${on ? 'border-sage bg-sage-light text-sage-dark' : 'border-line bg-paper text-muted hover:text-ink'}`

function Stat({ icon, bg, label, value, onClick, alert }: { icon: IconName; bg: string; label: string; value: ReactNode; onClick: () => void; alert?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="grid content-start gap-2 rounded-(--radius-card) bg-paper/85 p-4 text-left shadow-soft transition hover:-translate-y-px">
      <span className="flex items-center gap-2 text-[length:calc(12px*var(--fs))] font-semibold text-[#55645d]">
        <IconBadge name={icon} bg={bg} />
        {label}
      </span>
      <span className={`text-[length:calc(20px*var(--fs))] leading-tight font-extrabold tracking-tight ${alert ? 'text-[#b4532a]' : ''}`}>{value}</span>
    </button>
  )
}

function DueBadge({ d }: { d: DueInfo }) {
  const { t } = useTranslation()
  const text = d.daysLeft < 0 ? t('inv.due.overdue', { count: -d.daysLeft }) : d.daysLeft === 0 ? t('inv.due.today') : t('inv.due.inDays', { count: d.daysLeft })
  return <span className={`${badge} ${TONE[dueTone(d.daysLeft)]}`}>{text}</span>
}

function ItemCard({
  item: x,
  todayISO,
  time,
  link,
  dateLabel,
  onEdit,
  onToast,
}: {
  item: InventoryItem
  todayISO: string
  time: string
  link: ReturnType<typeof shoppingLink>
  dateLabel: (iso: string) => string
  onEdit: () => void
  onToast: (msg: string) => void
}) {
  const { t } = useTranslation()
  const adjustStock = useAppStore((s) => s.adjustStock)
  const markReplaced = useAppStore((s) => s.markReplaced)
  const addToShopping = useAppStore((s) => s.addInventoryToShopping)
  const restockFromShopping = useAppStore((s) => s.restockFromShopping)
  const st = useInvCategories().of(x.cat)
  const low = isLow(x)
  const dues = dueDates(x, todayISO)
  const unit = x.unit || t('inv.defaultUnit')
  const label = (d: DueInfo) => t(`inv.due.${d.kind}`)

  return (
    <li className="grid content-start gap-3 rounded-xl border border-l-4 border-line bg-paper p-4 transition hover:-translate-y-px" style={{ borderLeftColor: st.fg }}>
      <div className="flex items-start gap-3">
        <IconBadge name={st.icon} bg={st.bg} />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onEdit}>
          <strong className="block truncate text-sm">{x.name}</strong>
          <small className="mt-0.5 block text-[length:calc(11px*var(--fs))] text-muted">{[st.label, x.note].filter(Boolean).join(' · ')}</small>
        </button>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {dues[0] && dues[0].daysLeft <= 7 && <DueBadge d={dues[0]} />}
          <span className={`${badge} ${low ? TONE.low : TONE.enough}`}>{low ? t('inv.badge.low') : t('inv.badge.enough')}</span>
        </div>
      </div>

      {/* 更換週期與有效期限 */}
      {dues.length > 0 && (
        <ul className="grid gap-1.5 rounded-lg bg-oat px-3 py-2 text-[length:calc(12px*var(--fs))]">
          {dues.map((d) => (
            <li key={d.kind} className="grid gap-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-[#55645d]">{label(d)}</span>
                <span className="text-muted">
                  {d.kind === 'replace' && t('inv.due.everyDays', { count: x.cycleDays }) + ' · '}
                  {d.kind === 'pao' && t('inv.due.paoDetail', { months: x.paoMonths }) + ' · '}
                  {dateLabel(d.date)}
                </span>
                <span className="ml-auto">
                  <DueBadge d={d} />
                </span>
              </div>
              {d.kind === 'replace' && (
                <div className="h-1.5 overflow-hidden rounded-full bg-[#e6ece8]" role="progressbar" aria-label={t('inv.due.progress', { name: x.name })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(cyclePercent(x, todayISO))}>
                  <div className={`h-full rounded-full ${d.daysLeft < 0 ? 'bg-[#e08a7e]' : d.daysLeft <= 7 ? 'bg-[#f0b766]' : 'bg-sage'}`} style={{ width: `${cyclePercent(x, todayISO)}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 庫存 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[length:calc(12px*var(--fs))] text-muted">
          {t('inv.stock.label')}
          <b className={`mx-1 text-[length:calc(18px*var(--fs))] ${low ? 'text-[#6b3fa0]' : 'text-ink'}`}>{x.stock}</b>
          {unit} · {t('inv.stock.min', { count: x.minStock, unit })}
        </span>
        <div className="ml-auto flex gap-1.5">
          <button type="button" aria-label={t('inv.stock.useAria', { name: x.name })} disabled={x.stock <= 0} onClick={() => adjustStock(x.id, -1)} className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-3 py-1 text-xs font-bold hover:bg-sage-light disabled:opacity-40">
            <Icon name="minus" className="size-[1.2em]" />
            {t('inv.stock.use')}
          </button>
          <button type="button" aria-label={t('inv.stock.addAria', { name: x.name })} onClick={() => adjustStock(x.id, 1)} className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-3 py-1 text-xs font-bold hover:bg-sage-light">
            <Icon name="plus" className="size-[1.2em]" />
            {t('inv.stock.add')}
          </button>
        </div>
      </div>

      {/* 動作：已更換、與購物清單連動 */}
      {(x.cycleDays > 0 || low || link.state !== 'none') && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          {x.cycleDays > 0 && (
            <Button
              variant="ghost"
              className="px-3! py-1.5!"
              onClick={() => {
                markReplaced(x.id, todayISO)
                onToast(t('inv.toast.replaced', { name: x.name }))
              }}
            >
              {t('inv.action.replaced')}
            </Button>
          )}
          {link.state === 'bought' ? (
            <Button
              className="ml-auto px-3! py-1.5!"
              onClick={() => {
                const n = restockFromShopping(x.id)
                onToast(t('inv.toast.restocked', { name: x.name, count: n, unit }))
              }}
            >
              {t('inv.action.restock', { count: link.expense.quantity ?? 1, unit })}
            </Button>
          ) : link.state === 'pending' ? (
            <span className="ml-auto inline-flex items-center gap-1 rounded-(--radius-control) bg-sage-light px-3 py-1.5 text-xs font-bold text-sage-dark" aria-live="polite">
              <Icon name="check" className="size-[1.2em]" />
              {t('inv.action.inList', { count: link.expense.quantity ?? 1, unit })}
            </span>
          ) : (
            low && (
              <Button
                className="ml-auto px-3! py-1.5!"
                onClick={() => {
                  const n = addToShopping(x.id, todayISO, time)
                  if (n > 0) onToast(t('inv.toast.added', { name: x.name, count: n, unit }))
                }}
              >
                {t('inv.action.addToList', { count: restockQty(x), unit })}
              </Button>
            )
          )}
        </div>
      )}
    </li>
  )
}

/** 這個週期已經過了幾 %（0–100） */
function cyclePercent(x: InventoryItem, todayISO: string) {
  if (!x.lastReplaced || x.cycleDays <= 0) return 0
  return Math.min(100, Math.max(0, (daysBetween(x.lastReplaced, todayISO) / x.cycleDays) * 100))
}

const num = (s: string, fallback = 0) => {
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function ItemDialog({ item, todayISO, onClose }: { item: InventoryItem | null; todayISO: string; onClose: () => void }) {
  const { t } = useTranslation()
  const addInventory = useAppStore((s) => s.addInventory)
  const updateInventory = useAppStore((s) => s.updateInventory)
  const removeInventory = useAppStore((s) => s.removeInventory)
  const cats = useInvCategories()
  const [managing, setManaging] = useState(false)
  const uid = useId()
  const [draft, setDraft] = useState<InventoryInput>(
    () => (item ? { ...item, cat: cats.of(item.cat).key } : null) ?? { name: '', cat: 'home', unit: '', stock: 1, minStock: 1, lastReplaced: todayISO, cycleDays: 0, expiry: '', openedDate: '', paoMonths: 0, note: '' },
  )
  // 數字欄位用字串存，輸入時才不會被打斷
  const [nums, setNums] = useState(() => ({
    stock: String(draft.stock),
    minStock: String(draft.minStock),
    cycleDays: draft.cycleDays ? String(draft.cycleDays) : '',
    paoMonths: draft.paoMonths ? String(draft.paoMonths) : '',
  }))
  const [error, setError] = useState('')
  const set = (patch: Partial<InventoryInput>) => setDraft((d) => ({ ...d, ...patch }))
  const setNum = (k: keyof typeof nums, v: string) => setNums((n) => ({ ...n, [k]: v }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const name = draft.name.trim()
    if (!name) return setError(t('inv.form.nameRequired'))
    const data: InventoryInput = {
      ...draft,
      name,
      // 編輯中分類被刪掉時改存「其他」
      cat: cats.of(draft.cat).key,
      unit: draft.unit.trim(),
      note: draft.note.trim(),
      stock: num(nums.stock),
      minStock: num(nums.minStock),
      cycleDays: Math.round(num(nums.cycleDays)),
      paoMonths: Math.round(num(nums.paoMonths)),
    }
    if (item) updateInventory(item.id, data)
    else addInventory(data)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={item ? t('inv.form.editTitle') : t('inv.form.newTitle')}>
      <form onSubmit={submit} className="grid gap-4">
        <Field label={t('inv.form.name')} placeholder={t('inv.form.namePlaceholder')} value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
        {error && <p className="-mt-2 text-xs text-[#c2583d]">{error}</p>}
        <div className="grid gap-2">
          <IconSelect label={t('inv.form.cat')} value={cats.of(draft.cat).key} options={cats.list.map((c) => ({ value: c.key, label: c.label, icon: c.icon, bg: c.bg }))} onChange={(cat) => set({ cat })} />
          {/* 選「其他」（或自訂分類）時可以自己新增、刪除分類 */}
          {(draft.cat === 'other' || isCustomInvCat(draft.cat)) && (
            <CustomCatEditor onAdded={(cat) => set({ cat })} onRemoved={(id) => setDraft((d) => (d.cat === id ? { ...d, cat: 'other' } : d))} />
          )}
          <button type="button" onClick={() => setManaging(true)} className="w-fit text-[length:calc(12px*var(--fs))] font-semibold text-sage-dark underline-offset-2 hover:underline">
            {t('inv.cats.manageLink')}
          </button>
        </div>

        <fieldset className="grid gap-3 rounded-(--radius-control) border border-line p-3">
          <legend className="px-1 text-xs font-bold text-sage-dark">{t('inv.form.stockSection')}</legend>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('inv.form.stock')} type="number" inputMode="numeric" min={0} step="any" value={nums.stock} onChange={(e) => setNum('stock', e.target.value)} />
            <Field label={t('inv.form.minStock')} type="number" inputMode="numeric" min={0} step="any" value={nums.minStock} onChange={(e) => setNum('minStock', e.target.value)} />
            <Field label={t('inv.form.unit')} placeholder={t('inv.defaultUnit')} list={`${uid}-unit`} value={draft.unit} onChange={(e) => set({ unit: e.target.value })} />
          </div>
          <p className="-mt-1 text-[length:calc(11px*var(--fs))] text-muted">{t('inv.form.minStockHint')}</p>
          <datalist id={`${uid}-unit`}>
            {t('inv.unitSuggest').split('|').map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </fieldset>

        <fieldset className="grid gap-3 rounded-(--radius-control) border border-line p-3">
          <legend className="px-1 text-xs font-bold text-sage-dark">{t('inv.form.cycleSection')}</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('inv.form.lastReplaced')} type="date" value={draft.lastReplaced} onChange={(e) => set({ lastReplaced: e.target.value })} />
            <Field label={t('inv.form.cycleDays')} type="number" inputMode="numeric" min={0} placeholder={t('inv.form.cyclePlaceholder')} list={`${uid}-cycle`} value={nums.cycleDays} onChange={(e) => setNum('cycleDays', e.target.value)} />
          </div>
          <datalist id={`${uid}-cycle`}>
            {[30, 60, 90, 180].map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </fieldset>

        <fieldset className="grid gap-3 rounded-(--radius-control) border border-line p-3">
          <legend className="px-1 text-xs font-bold text-sage-dark">{t('inv.form.expirySection')}</legend>
          <Field label={t('inv.form.expiry')} type="date" value={draft.expiry} onChange={(e) => set({ expiry: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('inv.form.openedDate')} type="date" value={draft.openedDate} onChange={(e) => set({ openedDate: e.target.value })} />
            <Field label={t('inv.form.paoMonths')} type="number" inputMode="numeric" min={0} placeholder={t('inv.form.paoPlaceholder')} list={`${uid}-pao`} value={nums.paoMonths} onChange={(e) => setNum('paoMonths', e.target.value)} />
          </div>
          <datalist id={`${uid}-pao`}>
            {[3, 6, 12, 24].map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </fieldset>

        <Field label={t('inv.form.note')} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
        <div className="mt-2 flex gap-2">
          {item && (
            <Button
              variant="danger"
              onClick={() => {
                if (!window.confirm(t('inv.form.deleteConfirm', { name: item.name }))) return
                removeInventory(item.id)
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
      {managing && <InvCategoryDialog onClose={() => setManaging(false)} />}
    </Dialog>
  )
}
