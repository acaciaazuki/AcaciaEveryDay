import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '../components/Button'
import { Icon } from '../components/AcaciaIcons'
import { EventIconBadge } from '../components/EventIcon'
import { EventDialog } from '../components/EventDialog'
import { HolidayCard } from '../components/HolidayAgenda'
import { PageHead } from '../components/PageHead'
import { SharedCard, SharedDetailDialog } from '../components/SharedAgenda'
import { sharedOn, type SharedEntry } from '../core/calendarView'
import { RhythmDialog } from '../components/RhythmDialog'
import { ShoppingBadge, ShoppingCard, ShoppingDetailDialog } from '../components/ShoppingAgenda'
import { addDays, dateRange, toLocalISO } from '../core/date'
import { eventIconOf } from '../core/eventIcons'
import type { CalendarEvent } from '../core/schema'
import { agendaOn, type AgendaItem, type ShoppingEntry } from '../core/shoppingAgenda'
import { dayRhythm, eventsOn, greetingKey, hours, rhythmTimes } from '../core/today'
import { isLow } from '../core/inventory'
import { formatTime, formatTimeRange, periodFirst, timeParts } from '../core/time'
import { useNow } from '../hooks/useNow'
import { useShoppingByDate } from '../hooks/useShoppingAgenda'
import { useHolidaysByDate } from '../hooks/useHolidays'
import { useVisibleCalendar } from '../hooks/useVisibleCalendar'
import type { HolidayEntry } from '../core/holidays'
import { useAppStore } from '../store/useAppStore'

type View = 'day' | 'week' | 'two'
const VIEW_DAYS: Record<View, number> = { day: 1, week: 7, two: 14 }
const VIEWS: View[] = ['day', 'week', 'two']
// 相對今天的天數 → 翻譯 key（昨天、明天、後天、大後天）
const RELATIVE: Record<number, string> = { [-1]: 'yesterday', 1: 'tomorrow', 2: 'dayAfter', 3: 'threeDays' }

const card = 'rounded-(--radius-card) bg-paper p-5 shadow-card'
const NO_SHOPPING = new Map()
const NO_EVENTS: CalendarEvent[] = []
const linkBtn = 'text-xs font-semibold text-sage hover:text-sage-dark'

export function TodayPage() {
  const { t, i18n } = useTranslation()
  const personalEvents = useAppStore((s) => s.events)
  // 共享行程經過權限過濾；預覽其他成員時不顯示個人行程與購物
  const vis = useVisibleCalendar()
  const allEvents = vis.showPersonal ? personalEvents : NO_EVENTS
  const tasks = useAppStore((s) => s.tasks)
  const settings = useAppStore((s) => s.settings)
  const { wake, sleep } = rhythmTimes(settings)
  const [editingRhythm, setEditingRhythm] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | SharedEntry | 'new' | null>(null)
  const [viewingShared, setViewingShared] = useState<SharedEntry | null>(null)
  const openShared = (x: SharedEntry) => (x.canEdit ? setEditing(x) : setViewingShared(x))
  const [offset, setOffset] = useState(0) // 目前看的日期，相對今天的天數
  const [view, setView] = useState<View>('day')
  // 購物記帳連動進來的行程（唯讀）
  const allShopping = useShoppingByDate()
  const shopByDate = vis.showPersonal ? allShopping : NO_SHOPPING
  const [viewingShop, setViewingShop] = useState<ShoppingEntry | null>(null)
  // 匯入的國定假日（唯讀），顯示在時間軸最上面
  const holidaysByDate = useHolidaysByDate()

  const now = useNow()
  const todayISO = toLocalISO(now)
  const viewISO = addDays(todayISO, offset)
  const viewDate = new Date(`${viewISO}T00:00`)
  const span = VIEW_DAYS[view]
  const days = dateRange(viewISO, span)
  // 節奏與空檔：個人行程＋看得到的共享行程（忙閒區塊只用到時間，不含內容）
  const busyOn = (d: string) => [...eventsOn(allEvents, d), ...sharedOn(vis.shared, d)]
  const agenda = (d: string) => agendaOn(allEvents, shopByDate, d, vis.shared)
  const items = agenda(viewISO)
  // 行程數包含購物；節奏與自由時間只看一般行程（購物記帳只有時間點，沒有結束時間）
  const rangeCount = days.reduce((n, d) => n + agenda(d).length, 0)
  const openTasks = tasks.filter((x) => !x.done)
  const rhythm = dayRhythm(busyOn(viewISO), wake, sleep)
  const freeMinutes = days.reduce((sum, d) => sum + dayRhythm(busyOn(d), wake, sleep).freeMinutes, 0)
  const lng = i18n.resolvedLanguage
  const dateLabel = new Intl.DateTimeFormat(lng, { dateStyle: 'full' }).format(viewDate)
  const shortDate = new Intl.DateTimeFormat(lng, { month: 'long', day: 'numeric' }).format(viewDate)
  const title =
    offset === 0
      ? t(`today.greeting.${greetingKey(now.getHours())}`)
      : RELATIVE[offset]
        ? t(`today.relative.${RELATIVE[offset]}`)
        : new Intl.DateTimeFormat(lng, { month: 'long', day: 'numeric', weekday: 'long' }).format(viewDate)
  const stepBtn = 'grid size-6 place-items-center rounded-full border border-line bg-paper text-sm text-ink hover:bg-sage-light'

  return (
    <>
      <PageHead
        eyebrow={
          <span className="flex flex-wrap items-center gap-1.5">
            <button type="button" aria-label={t('today.prev')} onClick={() => setOffset(offset - span)} className={stepBtn}>
              ‹
            </button>
            <span>{dateLabel}</span>
            <button type="button" aria-label={t('today.next')} onClick={() => setOffset(offset + span)} className={stepBtn}>
              ›
            </button>
            {offset !== 0 && (
              <button type="button" onClick={() => setOffset(0)} className="rounded-full bg-sage-light px-2.5 py-1 text-[length:calc(11px*var(--fs))] font-bold text-sage-dark hover:bg-mint">
                {t('today.backToToday')}
              </button>
            )}
          </span>
        }
        title={title}
        actions={
          <>
            <Link to="/calendar" className="inline-flex items-center gap-1.5 rounded-(--radius-control) border border-line bg-paper px-4 py-2.5 text-xs font-bold hover:bg-sage-light">
              <Icon name="calendar" className="size-[1.8em]" />
              {t('today.seeCalendar')}
            </Link>
            {vis.isSelf && <Button onClick={() => setEditing('new')}>{t('today.addEvent')}</Button>}
          </>
        }
      />

      <section className="mb-5 flex items-center justify-between gap-4 rounded-(--radius-card) bg-linear-to-br from-mint to-sage-light p-6">
        <div>
          <h2 className="mb-1.5 text-lg font-extrabold">{t('today.bannerTitle')}</h2>
          <p className="mb-4 text-[length:calc(13px*var(--fs))] text-[#55645d]">{t('today.bannerText')}</p>
          <div className="flex flex-wrap gap-2">
            {[
              [rangeCount, t('today.statEvents')],
              [openTasks.length, t('today.statTasks')],
              [`${hours(freeMinutes)}h`, t('today.statFree')],
            ].map(([n, label]) => (
              <span key={String(label)} className="rounded-full bg-paper/80 px-3 py-1.5 text-xs text-[#55645d]">
                <b className="mr-1 text-ink">{n}</b>
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="hidden text-[calc(48px*var(--fs))] text-[#5f7a70] sm:block" aria-hidden>
          <Icon name="cloudSun" className="size-[1.8em]" />
        </div>
      </section>

      <div className="grid gap-5 min-[1001px]:grid-cols-[1fr_320px]">
        <section className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">{offset === 0 && view === 'day' ? t('today.timeline') : t('today.timelineOther')}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div role="group" aria-label={t('today.viewLabel')} className="flex rounded-full bg-oat p-0.5">
                {VIEWS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={`rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap transition ${view === v ? 'bg-paper text-sage-dark shadow-soft' : 'text-muted hover:text-ink'}`}
                  >
                    {t(`today.view.${v}`)}
                  </button>
                ))}
              </div>
              <Link to="/calendar" className={linkBtn}>
                {t('today.fullSchedule')}
              </Link>
            </div>
          </div>
          {view === 'day' && (holidaysByDate.get(viewISO)?.length ?? 0) > 0 && (
            <ul className="mb-3 grid gap-2">
              {holidaysByDate.get(viewISO)!.map((h) => (
                <li key={h.id}>
                  <HolidayCard holiday={h} />
                </li>
              ))}
            </ul>
          )}
          {view !== 'day' ? (
            <RangeList days={days} agenda={agenda} holidays={(d) => holidaysByDate.get(d) ?? []} lng={lng} todayISO={todayISO} onEdit={setEditing} onShop={setViewingShop} onShared={openShared} />
          ) : items.length === 0 ? (
            <button type="button" disabled={!vis.isSelf} onClick={() => setEditing('new')} className="w-full rounded-xl border border-dashed border-line py-8 text-center text-muted hover:bg-oat">
              {offset === 0 ? t('today.timelineEmpty') : t('today.timelineEmptyOther')}
            </button>
          ) : (
            <ol className="grid gap-2">
              {items.map((it, i) => {
                const next = items.at(i + 1)
                if (it.kind === 'shopping')
                  return (
                    <li key={it.id} className="relative grid grid-cols-[calc(48px*var(--fs))_calc(36px*var(--fs))_1fr] items-start gap-x-3">
                      <TimelineTime hhmm={it.start} lng={lng} />
                      <ShoppingBadge className="relative z-10 ring-4 ring-paper" />
                      {next && <span aria-hidden className="absolute top-[calc(36px*var(--fs)+0.25rem)] -bottom-2 left-[calc(48px*var(--fs)+0.75rem+18px*var(--fs)-1px)] w-0.5 bg-[#e1eae5]" />}
                      <ShoppingCard entry={it.entry} onOpen={setViewingShop} />
                    </li>
                  )
                if (it.kind === 'shared')
                  return (
                    <li key={it.id} className="relative grid grid-cols-[calc(48px*var(--fs))_calc(36px*var(--fs))_1fr] items-start gap-x-3">
                      <TimelineTime hhmm={it.start} lng={lng} />
                      <EventIconBadge icon={it.shared.access === 'busy' || it.shared.maskedFields.includes('title') ? 'default' : eventIconOf(it.shared.item)} className="relative z-10 ring-4 ring-paper" />
                      {next && <span aria-hidden className="absolute top-[calc(36px*var(--fs)+0.25rem)] -bottom-2 left-[calc(48px*var(--fs)+0.75rem+18px*var(--fs)-1px)] w-0.5 bg-[#e1eae5]" />}
                      <SharedCard entry={it.shared} onOpen={openShared} />
                    </li>
                  )
                const e = it.event
                const gap = next && e.end && next.start > e.end ? diffMin(e.end, next.start) : 0
                return (
                  <li key={e.id} className="relative grid grid-cols-[calc(48px*var(--fs))_calc(36px*var(--fs))_1fr] items-start gap-x-3">
                    <TimelineTime hhmm={e.start} lng={lng} />
                    <EventIconBadge icon={eventIconOf(e)} className="relative z-10 ring-4 ring-paper" />
                    {/* 垂直時間軸線：從這顆徽章連到下一顆 */}
                    {next && <span aria-hidden className="absolute top-[calc(36px*var(--fs)+0.25rem)] -bottom-2 left-[calc(48px*var(--fs)+0.75rem+18px*var(--fs)-1px)] w-0.5 bg-[#e1eae5]" />}
                    <button
                      type="button"
                      onClick={() => setEditing(e)}
                      className="rounded-xl border-l-4 px-4 py-3 text-left transition hover:-translate-y-px"
                      style={{ background: e.bgColor || '#f2f8f4', borderLeftColor: e.titleColor || '#75b799' }}
                    >
                      <h3 className="font-bold" style={{ color: e.titleColor || 'var(--color-ink)' }}>
                        {e.title}
                      </h3>
                      <small className="text-[length:calc(11px*var(--fs))] text-muted">
                        {formatTimeRange(e.start, e.end, lng) || t('event.allDay')} {e.note && `· ${e.note}`}
                      </small>
                    </button>
                    {gap >= 30 && (
                      <p className="col-start-3 flex items-center gap-1.5 py-1.5 pl-1 text-[length:calc(11px*var(--fs))] text-[#9aa6a0]">
                        <Icon name="cloud" className="size-[1.8em]" />
                        {t('today.gap')} · {hours(gap)}h
                      </p>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
          {vis.isSelf && (view !== 'day' || items.length > 0) && (
            <button type="button" onClick={() => setEditing('new')} className={`${linkBtn} mt-4`}>
              {t('today.addOne')}
            </button>
          )}
        </section>

        <div className="grid content-start gap-5">
          <section className={card}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-bold">{offset === 0 ? t('today.rhythm') : t('today.rhythmOn', { date: shortDate })}</h2>
              <button type="button" onClick={() => setEditingRhythm(true)} aria-label={t('rhythm.edit')} className={linkBtn}>
                {t('rhythm.editShort')}
              </button>
            </div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <strong>
                  {formatTime(wake, lng)} <span className="text-xs text-[#a8b1ac]">—</span> {formatTime(sleep, lng)}
                </strong>
                <small className="block text-[length:calc(11px*var(--fs))] text-muted">{t('today.rhythmRange')}</small>
              </div>
              <span className="text-2xl text-[#5f7a70]" aria-hidden>
                <Icon name="moon" className="size-[1.5em]" />
              </span>
            </div>
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-[#f0f3f1]">
              <div className="h-full bg-sage transition-[width] duration-500" style={{ width: `${(rhythm.busyMinutes / rhythm.totalMinutes) * 100}%` }} />
            </div>
            <div className="flex justify-between text-[length:calc(11px*var(--fs))] text-muted">
              <span>{t('today.busy', { h: hours(rhythm.busyMinutes) })}</span>
              <b className="text-sage-dark">{t('today.free', { h: hours(rhythm.freeMinutes) })}</b>
            </div>
          </section>

          <QuickTasks />
        </div>
      </div>

      {editing && (
        <EventDialog
          key={editing === 'new' ? 'new' : editing.id}
          event={editing === 'new' || 'access' in editing ? null : editing}
          shared={editing !== 'new' && 'access' in editing ? editing : undefined}
          date={viewISO}
          onClose={() => setEditing(null)}
        />
      )}
      {viewingShared && <SharedDetailDialog entry={viewingShared} previewing={!vis.isSelf} onClose={() => setViewingShared(null)} />}
      {editingRhythm && <RhythmDialog onClose={() => setEditingRhythm(false)} />}
      {viewingShop && <ShoppingDetailDialog entry={viewingShop} onClose={() => setViewingShop(null)} />}
    </>
  )
}

/** 時間軸左側的時間：時間與 AM／PM 分兩行，窄欄位也放得下（日文「午後」在上） */
function TimelineTime({ hhmm, lng }: { hhmm: string; lng: string | undefined }) {
  const { t } = useTranslation()
  // 沒有時間的購物記帳當作整天
  if (!hhmm) return <span className="pt-1.5 text-xs leading-tight font-bold text-muted">{t('calendar.shopping.allDay')}</span>
  const p = timeParts(hhmm, lng)
  return (
    <time dateTime={hhmm} className={`flex pt-1.5 text-xs leading-tight font-bold text-muted ${periodFirst(lng) ? 'flex-col-reverse' : 'flex-col'}`}>
      <span className="tabular-nums">{p?.time ?? hhmm}</span>
      {p && <span className="text-[length:calc(10px*var(--fs))] font-semibold">{p.period}</span>}
    </time>
  )
}

/** 一週／兩週檢視：依日期分組列出行程，沒有行程的日子只留一行 */
function RangeList({
  days,
  agenda,
  holidays,
  lng,
  todayISO,
  onEdit,
  onShop,
  onShared,
}: {
  days: string[]
  agenda: (iso: string) => AgendaItem[]
  holidays: (iso: string) => HolidayEntry[]
  lng: string | undefined
  todayISO: string
  onEdit: (e: CalendarEvent) => void
  onShop: (x: ShoppingEntry) => void
  onShared: (x: SharedEntry) => void
}) {
  const { t } = useTranslation()
  const fmt = new Intl.DateTimeFormat(lng, { month: 'numeric', day: 'numeric', weekday: 'short' })
  return (
    <ol className="grid gap-1.5">
      {days.map((d) => {
        const evs = agenda(d)
        const hols = holidays(d)
        const label = fmt.format(new Date(`${d}T00:00`))
        const isToday = d === todayISO
        return (
          <li key={d} className="grid grid-cols-[calc(96px*var(--fs))_1fr] items-start gap-3">
            <div className={`pt-2 text-xs font-bold ${isToday ? 'text-sage-dark' : 'text-muted'}`}>
              {label}
              {isToday && <span className="mt-1 block w-fit rounded-full bg-sage px-1.5 py-px text-[length:calc(10px*var(--fs))] text-white">{t('today.todayBadge')}</span>}
            </div>
            {evs.length === 0 && hols.length === 0 ? (
              <span className="py-2 text-[length:calc(11px*var(--fs))] text-[#a5b0aa]">{t('today.rangeEmpty')}</span>
            ) : (
              <ul className="grid gap-1.5">
                {hols.map((h) => (
                  <li key={h.id}>
                    <HolidayCard compact holiday={h} />
                  </li>
                ))}
                {evs.map((it) => {
                  if (it.kind === 'shopping')
                    return (
                      <li key={it.id}>
                        <ShoppingCard compact entry={it.entry} onOpen={onShop} />
                      </li>
                    )
                  if (it.kind === 'shared')
                    return (
                      <li key={it.id}>
                        <SharedCard compact entry={it.shared} onOpen={onShared} />
                      </li>
                    )
                  const e = it.event
                  return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onEdit(e)}
                      className="w-full rounded-xl border-l-4 px-3 py-2 text-left transition hover:-translate-y-px"
                      style={{ background: e.bgColor || '#f2f8f4', borderLeftColor: e.titleColor || '#75b799' }}
                    >
                      <strong className="block text-[length:calc(13px*var(--fs))]" style={{ color: e.titleColor || 'var(--color-ink)' }}>
                        {e.title}
                      </strong>
                      <small className="text-[length:calc(11px*var(--fs))] text-muted">
                        {formatTimeRange(e.start, e.end, lng) || t('event.allDay')} {e.note && `· ${e.note}`}
                      </small>
                    </button>
                  </li>
                  )
                })}
              </ul>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function diffMin(a: string, b: string) {
  const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
  return m(b) - m(a)
}

function QuickTasks() {
  const { t } = useTranslation()
  const tasks = useAppStore((s) => s.tasks)
  const toggleTask = useAppStore((s) => s.toggleTask)
  const addTask = useAppStore((s) => s.addTask)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const top = tasks.filter((x) => !x.done).slice(0, 5)
  const inventory = useAppStore((s) => s.inventory)
  const lowCount = inventory.filter(isLow).length

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    addTask({ title: title.trim(), loc: '', date: toLocalISO(), time: '' })
    setTitle('')
    setOpen(false)
  }

  return (
    <section className={card}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">{t('today.quick')}</h2>
        <Link to="/tasks" className={linkBtn}>
          {t('today.all')}
        </Link>
      </div>
      {lowCount > 0 && (
        <Link to="/tasks" className="mb-1.5 flex items-center gap-2 rounded-xl bg-[#eef6f0] px-3 py-2.5 text-[length:calc(12px*var(--fs))] font-semibold text-sage-dark hover:bg-sage-light">
          <Icon name="box" className="size-[1.4em] shrink-0" />
          {t('today.lowStock', { count: lowCount })}
        </Link>
      )}
      {top.length === 0 ? (
        lowCount === 0 && <p className="py-2.5 text-[length:calc(11px*var(--fs))] text-[#a5b0aa]">{t('today.quickEmpty')}</p>
      ) : (
        <ul>
          {top.map((task) => (
            <li
              key={task.id}
              className="mb-1.5 flex items-center gap-2.5 rounded-xl px-3 py-2.5 last:mb-0"
              style={{ background: task.bgColor && task.bgColor !== '#ffffff' ? task.bgColor : '#f7f9f7', color: task.titleColor || undefined }}
            >
              <button type="button" aria-label={t('tasks.markDone')} onClick={() => toggleTask(task.id)} className="size-4.5 shrink-0 rounded-full border-2 border-[#cfd8d3] bg-paper/60 hover:border-sage" />
              <span className="text-[length:calc(13px*var(--fs))] font-semibold">{task.title}</span>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <form onSubmit={submit} className="mt-2 flex gap-2">
          <input
            autoFocus
            aria-label={t('today.quickPlaceholder')}
            placeholder={t('today.quickPlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            className="min-w-0 flex-1 rounded-(--radius-control) border border-line bg-oat px-3 py-2 text-[length:calc(13px*var(--fs))] outline-none focus:border-sage"
          />
          <Button type="submit">{t('common.add')}</Button>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`${linkBtn} mt-2`}>
          {t('today.quickAdd')}
        </button>
      )}
    </section>
  )
}
