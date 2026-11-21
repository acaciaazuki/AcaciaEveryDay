import { Fragment, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '../components/Button'
import { EventDialog } from '../components/EventDialog'
import { PageHead } from '../components/PageHead'
import { toLocalISO } from '../core/date'
import type { CalendarEvent } from '../core/schema'
import { dayRhythm, eventsOn, greetingKey, hours } from '../core/today'
import { useNow } from '../hooks/useNow'
import { useAppStore } from '../store/useAppStore'

const WAKE = '07:00'
const SLEEP = '23:00'

const card = 'rounded-(--radius-card) bg-paper p-5 shadow-card'
const linkBtn = 'text-xs font-semibold text-sage hover:text-sage-dark'

export function TodayPage() {
  const { t, i18n } = useTranslation()
  const allEvents = useAppStore((s) => s.events)
  const tasks = useAppStore((s) => s.tasks)
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null)

  const now = useNow()
  const iso = toLocalISO(now)
  const events = eventsOn(allEvents, iso)
  const openTasks = tasks.filter((x) => !x.done)
  const rhythm = dayRhythm(events, WAKE, SLEEP)
  const dateLabel = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'full' }).format(now)

  return (
    <>
      <PageHead
        eyebrow={dateLabel}
        title={t(`today.greeting.${greetingKey(now.getHours())}`)}
        actions={
          <>
            <Link to="/calendar" className="rounded-(--radius-control) border border-line bg-paper px-4 py-2.5 text-xs font-bold hover:bg-sage-light">
              {t('today.seeCalendar')}
            </Link>
            <Button onClick={() => setEditing('new')}>{t('today.addEvent')}</Button>
          </>
        }
      />

      <section className="mb-5 flex items-center justify-between gap-4 rounded-(--radius-card) bg-linear-to-br from-mint to-sage-light p-6">
        <div>
          <h2 className="mb-1.5 text-lg font-extrabold">{t('today.bannerTitle')}</h2>
          <p className="mb-4 text-[13px] text-[#55645d]">{t('today.bannerText')}</p>
          <div className="flex flex-wrap gap-2">
            {[
              [events.length, t('today.statEvents')],
              [openTasks.length, t('today.statTasks')],
              [`${hours(rhythm.freeMinutes)}h`, t('today.statFree')],
            ].map(([n, label]) => (
              <span key={String(label)} className="rounded-full bg-paper/80 px-3 py-1.5 text-xs text-[#55645d]">
                <b className="mr-1 text-ink">{n}</b>
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="hidden text-5xl sm:block" aria-hidden>
          🌤️
        </div>
      </section>

      <div className="grid gap-5 min-[1001px]:grid-cols-[1fr_320px]">
        <section className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">{t('today.timeline')}</h2>
            <Link to="/calendar" className={linkBtn}>
              {t('today.fullSchedule')}
            </Link>
          </div>
          {events.length === 0 ? (
            <button type="button" onClick={() => setEditing('new')} className="w-full rounded-xl border border-dashed border-line py-8 text-center text-muted hover:bg-oat">
              {t('today.timelineEmpty')}
            </button>
          ) : (
            <ol className="grid gap-2">
              {events.map((e, i) => {
                const next = events.at(i + 1)
                const gap = next && e.end && next.start > e.end ? diffMin(e.end, next.start) : 0
                return (
                  <Fragment key={e.id}>
                    <li className="grid grid-cols-[48px_1fr] items-start gap-3">
                      <time className="pt-3 text-xs font-bold text-muted">{e.start}</time>
                      <button
                        type="button"
                        onClick={() => setEditing(e)}
                        className="rounded-xl border-l-4 px-4 py-3 text-left transition hover:-translate-y-px"
                        style={{ background: e.bgColor || '#f2f8f4', borderLeftColor: e.titleColor || '#75b799' }}
                      >
                        <h3 className="font-bold" style={{ color: e.titleColor || 'var(--color-ink)' }}>
                          {e.title}
                        </h3>
                        <small className="text-[11px] text-muted">
                          {e.start}–{e.end} {e.note && `· ${e.note}`}
                        </small>
                      </button>
                    </li>
                    {gap >= 30 && (
                      <li className="ml-[60px] py-1 text-[11px] text-[#9aa6a0]">
                        {t('today.gap')} · {hours(gap)}h
                      </li>
                    )}
                  </Fragment>
                )
              })}
            </ol>
          )}
          {events.length > 0 && (
            <button type="button" onClick={() => setEditing('new')} className={`${linkBtn} mt-4`}>
              {t('today.addOne')}
            </button>
          )}
        </section>

        <div className="grid content-start gap-5">
          <section className={card}>
            <h2 className="mb-3 font-bold">{t('today.rhythm')}</h2>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <strong>
                  {WAKE} <span className="text-xs text-[#a8b1ac]">—</span> {SLEEP}
                </strong>
                <small className="block text-[11px] text-muted">{t('today.rhythmRange')}</small>
              </div>
              <span className="text-2xl" aria-hidden>
                🌙
              </span>
            </div>
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-[#f0f3f1]">
              <div className="h-full bg-sage transition-[width] duration-500" style={{ width: `${(rhythm.busyMinutes / rhythm.totalMinutes) * 100}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-muted">
              <span>{t('today.busy', { h: hours(rhythm.busyMinutes) })}</span>
              <b className="text-sage-dark">{t('today.free', { h: hours(rhythm.freeMinutes) })}</b>
            </div>
          </section>

          <QuickTasks />
        </div>
      </div>

      {editing && <EventDialog key={editing === 'new' ? 'new' : editing.id} event={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
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
        <p className="py-2.5 text-[11px] text-[#a5b0aa]">{t('today.quickEmpty')}</p>
      ) : (
        <ul>
          {top.map((task) => (
            <li
              key={task.id}
              className="mb-1.5 flex items-center gap-2.5 rounded-xl px-3 py-2.5 last:mb-0"
              style={{ background: task.bgColor && task.bgColor !== '#ffffff' ? task.bgColor : '#f7f9f7', color: task.titleColor || undefined }}
            >
              <button type="button" aria-label={t('tasks.markDone')} onClick={() => toggleTask(task.id)} className="size-4.5 shrink-0 rounded-full border-2 border-[#cfd8d3] bg-paper/60 hover:border-sage" />
              <span className="text-[13px] font-semibold">{task.title}</span>
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
            className="min-w-0 flex-1 rounded-(--radius-control) border border-line bg-oat px-3 py-2 text-[13px] outline-none focus:border-sage"
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
