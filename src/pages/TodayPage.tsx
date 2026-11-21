import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '../components/Button'
import { Icon } from '../components/AcaciaIcons'
import { EventIconBadge } from '../components/EventIcon'
import { EventDialog } from '../components/EventDialog'
import { PageHead } from '../components/PageHead'
import { addDays, dateRange, toLocalISO } from '../core/date'
import { eventIconOf } from '../core/eventIcons'
import type { CalendarEvent } from '../core/schema'
import { dayRhythm, eventsOn, greetingKey, hours } from '../core/today'
import { useNow } from '../hooks/useNow'
import { useAppStore } from '../store/useAppStore'

type View = 'day' | 'week' | 'two'
const VIEW_DAYS: Record<View, number> = { day: 1, week: 7, two: 14 }
const VIEWS: View[] = ['day', 'week', 'two']
// 相對今天的天數 → 翻譯 key（昨天、明天、後天、大後天）
const RELATIVE: Record<number, string> = { [-1]: 'yesterday', 1: 'tomorrow', 2: 'dayAfter', 3: 'threeDays' }

const WAKE = '07:00'
const SLEEP = '23:00'

const card = 'rounded-(--radius-card) bg-paper p-5 shadow-card'
const linkBtn = 'text-xs font-semibold text-sage hover:text-sage-dark'

export function TodayPage() {
  const { t, i18n } = useTranslation()
  const allEvents = useAppStore((s) => s.events)
  const tasks = useAppStore((s) => s.tasks)
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null)
  const [offset, setOffset] = useState(0) // 目前看的日期，相對今天的天數
  const [view, setView] = useState<View>('day')

  const now = useNow()
  const todayISO = toLocalISO(now)
  const viewISO = addDays(todayISO, offset)
  const viewDate = new Date(`${viewISO}T00:00`)
  const span = VIEW_DAYS[view]
  const days = dateRange(viewISO, span)
  const events = eventsOn(allEvents, viewISO)
  const rangeCount = days.reduce((n, d) => n + eventsOn(allEvents, d).length, 0)
  const openTasks = tasks.filter((x) => !x.done)
  const rhythm = dayRhythm(events, WAKE, SLEEP)
  const freeMinutes = days.reduce((sum, d) => sum + dayRhythm(eventsOn(allEvents, d), WAKE, SLEEP).freeMinutes, 0)
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
              <Icon name="calendar" className="size-[1.4em]" />
              {t('today.seeCalendar')}
            </Link>
            <Button onClick={() => setEditing('new')}>{t('today.addEvent')}</Button>
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
          <Icon name="cloudSun" className="size-[1.4em]" />
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
          {view !== 'day' ? (
            <RangeList days={days} events={allEvents} lng={lng} todayISO={todayISO} onEdit={setEditing} />
          ) : events.length === 0 ? (
            <button type="button" onClick={() => setEditing('new')} className="w-full rounded-xl border border-dashed border-line py-8 text-center text-muted hover:bg-oat">
              {offset === 0 ? t('today.timelineEmpty') : t('today.timelineEmptyOther')}
            </button>
          ) : (
            <ol className="grid gap-2">
              {events.map((e, i) => {
                const next = events.at(i + 1)
                const gap = next && e.end && next.start > e.end ? diffMin(e.end, next.start) : 0
                return (
                  <li key={e.id} className="relative grid grid-cols-[calc(48px*var(--fs))_calc(36px*var(--fs))_1fr] items-start gap-x-3">
                    <time className="pt-2.5 text-xs font-bold text-muted">{e.start}</time>
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
                        {e.start}–{e.end} {e.note && `· ${e.note}`}
                      </small>
                    </button>
                    {gap >= 30 && (
                      <p className="col-start-3 flex items-center gap-1.5 py-1.5 pl-1 text-[length:calc(11px*var(--fs))] text-[#9aa6a0]">
                        <Icon name="cloud" className="size-[1.4em]" />
                        {t('today.gap')} · {hours(gap)}h
                      </p>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
          {(view !== 'day' || events.length > 0) && (
            <button type="button" onClick={() => setEditing('new')} className={`${linkBtn} mt-4`}>
              {t('today.addOne')}
            </button>
          )}
        </section>

        <div className="grid content-start gap-5">
          <section className={card}>
            <h2 className="mb-3 font-bold">{offset === 0 ? t('today.rhythm') : t('today.rhythmOn', { date: shortDate })}</h2>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <strong>
                  {WAKE} <span className="text-xs text-[#a8b1ac]">—</span> {SLEEP}
                </strong>
                <small className="block text-[length:calc(11px*var(--fs))] text-muted">{t('today.rhythmRange')}</small>
              </div>
              <span className="text-2xl text-[#5f7a70]" aria-hidden>
                <Icon name="moon" className="size-[1.2em]" />
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

      {editing && <EventDialog key={editing === 'new' ? 'new' : editing.id} event={editing === 'new' ? null : editing} date={viewISO} onClose={() => setEditing(null)} />}
    </>
  )
}

/** 一週／兩週檢視：依日期分組列出行程，沒有行程的日子只留一行 */
function RangeList({ days, events, lng, todayISO, onEdit }: { days: string[]; events: CalendarEvent[]; lng: string | undefined; todayISO: string; onEdit: (e: CalendarEvent) => void }) {
  const { t } = useTranslation()
  const fmt = new Intl.DateTimeFormat(lng, { month: 'numeric', day: 'numeric', weekday: 'short' })
  return (
    <ol className="grid gap-1.5">
      {days.map((d) => {
        const evs = eventsOn(events, d)
        const label = fmt.format(new Date(`${d}T00:00`))
        const isToday = d === todayISO
        return (
          <li key={d} className="grid grid-cols-[calc(96px*var(--fs))_1fr] items-start gap-3">
            <div className={`pt-2 text-xs font-bold ${isToday ? 'text-sage-dark' : 'text-muted'}`}>
              {label}
              {isToday && <span className="mt-1 block w-fit rounded-full bg-sage px-1.5 py-px text-[length:calc(10px*var(--fs))] text-white">{t('today.todayBadge')}</span>}
            </div>
            {evs.length === 0 ? (
              <span className="py-2 text-[length:calc(11px*var(--fs))] text-[#a5b0aa]">{t('today.rangeEmpty')}</span>
            ) : (
              <ul className="grid gap-1.5">
                {evs.map((e) => (
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
                        {e.start}–{e.end} {e.note && `· ${e.note}`}
                      </small>
                    </button>
                  </li>
                ))}
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
      {top.length === 0 ? (
        <p className="py-2.5 text-[length:calc(11px*var(--fs))] text-[#a5b0aa]">{t('today.quickEmpty')}</p>
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
