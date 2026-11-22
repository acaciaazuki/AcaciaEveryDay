import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BatchEventsDialog } from '../components/BatchEventsDialog'
import { Button } from '../components/Button'
import { EventDialog } from '../components/EventDialog'
import { MonthNav } from '../components/MonthNav'
import { PageHead } from '../components/PageHead'
import { monthCells, shiftMonth, weekdayNames } from '../core/calendar'
import { toLocalISO } from '../core/date'
import type { CalendarEvent } from '../core/schema'
import { formatTime, formatTimeRange } from '../core/time'
import { eventsOn } from '../core/today'
import { useNow } from '../hooks/useNow'
import { useOpenFromUrl } from '../hooks/useOpenFromUrl'
import { useAppStore } from '../store/useAppStore'

// 桌面版每天最多顯示的行程標籤數，超過的折成「還有 X 個」
const MAX_CHIPS = 6

export function CalendarPage() {
  const { t, i18n } = useTranslation()
  const events = useAppStore((s) => s.events)
  const lng = i18n.resolvedLanguage
  const now = useNow()
  const todayISO = toLocalISO(now)
  const [ym, setYm] = useState(() => ({ year: now.getFullYear(), month: now.getMonth() }))
  const [selected, setSelected] = useState(todayISO)
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)
  useOpenFromUrl(events, (e) => {
    const [y, m] = e.dateISO.split('-').map(Number)
    if (y && m) setYm({ year: y, month: m - 1 })
    if (e.dateISO) setSelected(e.dateISO)
    setEditing(e)
  })

  const cells = monthCells(ym.year, ym.month)
  const dayEvents = eventsOn(events, selected)
  const selectedLabel = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'full' }).format(new Date(`${selected}T00:00`))

  return (
    <>
      <PageHead
        eyebrow={t('calendar.eyebrow')}
        title={t('calendar.title')}
        actions={
          <>
            <Button variant="ghost" onClick={() => setBatchOpen(true)}>
              {t('calendar.batch')}
            </Button>
            <Button onClick={() => setEditing('new')}>{t('calendar.add')}</Button>
          </>
        }
      />

      <div className="grid gap-5 min-[1001px]:grid-cols-[1fr_320px]">
        <section className="rounded-(--radius-card) bg-paper p-4 shadow-card sm:p-5">
          <MonthNav
            year={ym.year}
            month={ym.month}
            onShift={(d) => setYm(shiftMonth(ym.year, ym.month, d))}
            onToday={() => {
              setYm({ year: now.getFullYear(), month: now.getMonth() })
              setSelected(todayISO)
            }}
          />
          <div role="grid" className="mt-4 grid grid-cols-7 gap-1">
            {weekdayNames(i18n.resolvedLanguage).map((w, i) => (
              <div key={i} role="columnheader" className="pb-1 text-center text-[length:calc(11px*var(--fs))] font-bold text-muted">
                {w}
              </div>
            ))}
            {cells.map((iso, i) => {
              if (!iso) return <div key={`pad-${i}`} />
              // 每週從星期日開始，第 0 欄是日、第 6 欄是六
              const weekend = i % 7 === 0 || i % 7 === 6
              const evs = eventsOn(events, iso)
              const isSel = iso === selected
              const isToday = iso === todayISO
              return (
                <div
                  key={iso}
                  role="gridcell"
                  aria-selected={isSel}
                  tabIndex={0}
                  onClick={() => setSelected(iso)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(iso)}
                  className={`min-h-20 cursor-pointer overflow-hidden rounded-lg border p-1 text-left transition sm:min-h-36 sm:p-1.5 min-[1001px]:min-h-40 ${
                    isSel ? `border-sage ${weekend ? 'bg-weekend' : 'bg-sage-light/60'}` : `border-transparent ${weekend ? 'bg-weekend hover:bg-weekend-hover' : 'hover:bg-oat'}`
                  }`}
                >
                  <div className={`mb-1 grid size-6 place-items-center rounded-full text-xs font-bold ${isToday ? 'bg-sage text-white' : ''}`}>{Number(iso.slice(8))}</div>
                  {/* 手機寬度只顯示圓點，桌面顯示行程標籤 */}
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {evs.slice(0, 4).map((e) => (
                      <span key={e.id} className="size-1.5 rounded-full" style={{ background: e.titleColor || '#4a987b' }} />
                    ))}
                  </div>
                  <div className="hidden gap-px sm:grid">
                    {evs.slice(0, MAX_CHIPS).map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation()
                          setEditing(e)
                        }}
                        className="truncate rounded px-1.5 py-px text-left text-[length:calc(10px*var(--fs))] leading-4 font-semibold"
                        style={{ background: e.bgColor || '#eaf6ef', color: e.titleColor || '#263633' }}
                      >
                        {formatTime(e.start, lng)} {e.title}
                      </button>
                    ))}
                    {evs.length > MAX_CHIPS && <span className="px-1.5 text-[length:calc(10px*var(--fs))] text-muted">{t('calendar.more', { count: evs.length - MAX_CHIPS })}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="content-start rounded-(--radius-card) bg-paper p-5 shadow-card">
          <h2 className="mb-3 font-bold">{selectedLabel}</h2>
          {dayEvents.length === 0 ? (
            <p className="py-2 text-[length:calc(13px*var(--fs))] text-muted">{t('calendar.dayEmpty')}</p>
          ) : (
            <ul className="grid gap-2">
              {dayEvents.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(e)}
                    className="w-full rounded-xl border-l-4 px-3 py-2.5 text-left"
                    style={{ background: e.bgColor || '#f2f8f4', borderLeftColor: e.titleColor || '#75b799' }}
                  >
                    <strong className="block text-[length:calc(13px*var(--fs))]" style={{ color: e.titleColor || 'var(--color-ink)' }}>
                      {e.title}
                    </strong>
                    <small className="text-[length:calc(11px*var(--fs))] text-muted">
                      {formatTimeRange(e.start, e.end, lng)} {e.note && `· ${e.note}`}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setEditing('new')} className="mt-3 text-xs font-semibold text-sage hover:text-sage-dark">
            {t('calendar.addOnDay')}
          </button>
        </section>
      </div>

      {editing && <EventDialog key={editing === 'new' ? 'new' : editing.id} event={editing === 'new' ? null : editing} date={selected} onClose={() => setEditing(null)} />}
      {batchOpen && <BatchEventsDialog initialYear={ym.year} initialMonth={ym.month} onClose={() => setBatchOpen(false)} />}
    </>
  )
}
