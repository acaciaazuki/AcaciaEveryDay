import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BatchEventsDialog } from '../components/BatchEventsDialog'
import { Button } from '../components/Button'
import { EventDialog } from '../components/EventDialog'
import { HolidayCard, HolidayChip, HolidayImportDialog } from '../components/HolidayAgenda'
import { MonthNav } from '../components/MonthNav'
import { PageHead } from '../components/PageHead'
import { SharedCard, SharedChip, SharedDetailDialog } from '../components/SharedAgenda'
import { SpaceSwitcher } from '../components/SpaceSwitcher'
import type { SharedEntry } from '../core/calendarView'
import { ShoppingCard, ShoppingChip, ShoppingDetailDialog } from '../components/ShoppingAgenda'
import { monthCells, shiftMonth, weekdayNames } from '../core/calendar'
import { toLocalISO } from '../core/date'
import type { CalendarEvent } from '../core/schema'
import { formatTime, formatTimeRange } from '../core/time'
import { agendaOn, type ShoppingEntry } from '../core/shoppingAgenda'
import { useNow } from '../hooks/useNow'
import { SHOP_STYLE, useShoppingByDate } from '../hooks/useShoppingAgenda'
import { useOpenFromUrl } from '../hooks/useOpenFromUrl'
import { useVisibleCalendar } from '../hooks/useVisibleCalendar'
import { HOLIDAY_STYLE, holidayStyle, useHolidaysByDate } from '../hooks/useHolidays'
import { useAppStore } from '../store/useAppStore'

// 桌面版每天最多顯示的行程標籤數，超過的折成「還有 X 個」
const MAX_CHIPS = 6
const NO_SHOPPING = new Map()
const NO_EVENTS: CalendarEvent[] = []
const isShared = (x: CalendarEvent | SharedEntry): x is SharedEntry => 'access' in x

export function CalendarPage() {
  const { t, i18n } = useTranslation()
  const allEvents = useAppStore((s) => s.events)
  // 共享空間行程一律經過權限過濾；預覽其他成員或篩選某個空間時，不顯示個人行程與購物
  const vis = useVisibleCalendar()
  const events = vis.showPersonal ? allEvents : NO_EVENTS
  const now = useNow()
  const todayISO = toLocalISO(now)
  const [ym, setYm] = useState(() => ({ year: now.getFullYear(), month: now.getMonth() }))
  const [selected, setSelected] = useState(todayISO)
  const [editing, setEditing] = useState<CalendarEvent | SharedEntry | 'new' | null>(null)
  const [viewingShared, setViewingShared] = useState<SharedEntry | null>(null)
  const openShared = (x: SharedEntry) => (x.canEdit ? setEditing(x) : setViewingShared(x))
  const [batchOpen, setBatchOpen] = useState(false)
  // 匯入的國定假日：唯讀，排在每天最前面
  const holidaysByDate = useHolidaysByDate()
  const [holidayOpen, setHolidayOpen] = useState(false)
  // 購物記帳連動進來的行程：只能看，點開是唯讀詳情
  const allShopping = useShoppingByDate()
  const shopByDate = vis.showPersonal ? allShopping : NO_SHOPPING
  const [viewingShop, setViewingShop] = useState<ShoppingEntry | null>(null)
  // ⌘K 搜尋結果導過來時開啟；共享行程依權限開編輯或唯讀詳情
  const openables = useMemo(() => [...events, ...vis.shared], [events, vis.shared])
  useOpenFromUrl(openables, (e) => {
    const [y, m] = e.dateISO.split('-').map(Number)
    if (y && m) setYm({ year: y, month: m - 1 })
    if (e.dateISO) setSelected(e.dateISO)
    if (isShared(e)) openShared(e)
    else setEditing(e)
  })

  const cells = monthCells(ym.year, ym.month)
  const dayItems = agendaOn(events, shopByDate, selected, vis.shared)
  const dayHolidays = holidaysByDate.get(selected) ?? []
  const selectedLabel = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'full' }).format(new Date(`${selected}T00:00`))

  return (
    <>
      <PageHead
        eyebrow={t('calendar.eyebrow')}
        title={t('calendar.title')}
        actions={
          // 預覽其他成員的視角時只能看，不顯示新增按鈕
          vis.isSelf && (
            <>
              <Button variant="ghost" onClick={() => setHolidayOpen(true)}>
                {t('holidays.open')}
              </Button>
              <Button variant="ghost" onClick={() => setBatchOpen(true)}>
                {t('calendar.batch')}
              </Button>
              <Button onClick={() => setEditing('new')}>{t('calendar.add')}</Button>
            </>
          )
        }
      />
      <SpaceSwitcher />

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
              const evs = agendaOn(events, shopByDate, iso, vis.shared)
              const hols = holidaysByDate.get(iso) ?? []
              // 放假日（不含補班）的日期數字用假日色
              const isHoliday = hols.some((h) => !h.work)
              const chipRoom = Math.max(0, MAX_CHIPS - hols.length)
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
                  <div
                    className={`mb-1 grid size-6 place-items-center rounded-full text-xs font-bold ${isToday ? 'bg-sage text-white' : ''}`}
                    style={isHoliday && !isToday ? { color: HOLIDAY_STYLE.day } : undefined}
                  >
                    {Number(iso.slice(8))}
                  </div>
                  {/* 手機寬度只顯示圓點，桌面顯示行程標籤 */}
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {hols.map((h) => (
                      <span key={h.id} data-holiday-dot={h.id} className="h-1.5 w-3 rounded-full" style={{ background: holidayStyle(h).dot }} />
                    ))}
                    {evs.slice(0, 4).map((it) => (
                      <span
                        key={it.id}
                        className="size-1.5 rounded-full"
                        style={{ background: it.kind === 'shopping' ? SHOP_STYLE.dot : it.kind === 'shared' ? (it.shared.access === 'busy' ? '#a9c9bb' : it.shared.space.color || '#75b799') : it.event.titleColor || '#4a987b' }}
                      />
                    ))}
                  </div>
                  <div className="hidden gap-px sm:grid">
                    {hols.map((h) => (
                      <HolidayChip key={h.id} holiday={h} />
                    ))}
                    {evs.slice(0, chipRoom).map((it) => {
                      if (it.kind === 'shopping') return <ShoppingChip key={it.id} entry={it.entry} onOpen={setViewingShop} />
                      if (it.kind === 'shared') return <SharedChip key={it.id} entry={it.shared} onOpen={openShared} />
                      const e = it.event
                      return (
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
                        {/* 行事曆版面一律 24 小時制；整天的行程不加時間，讓名稱多露一點 */}
                        {e.start && `${formatTime(e.start)} `}
                        {e.title}
                      </button>
                      )
                    })}
                    {evs.length > chipRoom && <span className="px-1.5 text-[length:calc(10px*var(--fs))] text-muted">{t('calendar.more', { count: evs.length - chipRoom })}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="content-start rounded-(--radius-card) bg-paper p-5 shadow-card">
          <h2 className="mb-3 font-bold">{selectedLabel}</h2>
          {dayHolidays.length > 0 && (
            <ul className="mb-2 grid gap-2">
              {dayHolidays.map((h) => (
                <li key={h.id}>
                  <HolidayCard compact holiday={h} />
                </li>
              ))}
            </ul>
          )}
          {dayItems.length === 0 ? (
            <p className="py-2 text-[length:calc(13px*var(--fs))] text-muted">{t('calendar.dayEmpty')}</p>
          ) : (
            <ul className="grid gap-2">
              {dayItems.map((it) => {
                if (it.kind === 'shopping')
                  return (
                    <li key={it.id}>
                      <ShoppingCard compact entry={it.entry} onOpen={setViewingShop} />
                    </li>
                  )
                if (it.kind === 'shared')
                  return (
                    <li key={it.id}>
                      <SharedCard compact entry={it.shared} onOpen={openShared} />
                    </li>
                  )
                const e = it.event
                return (
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
                      {formatTimeRange(e.start, e.end) || t('event.allDay')} {e.note && `· ${e.note}`}
                    </small>
                  </button>
                </li>
                )
              })}
            </ul>
          )}
          {vis.isSelf && (
            <button type="button" onClick={() => setEditing('new')} className="mt-3 text-xs font-semibold text-sage hover:text-sage-dark">
              {t('calendar.addOnDay')}
            </button>
          )}
        </section>
      </div>

      {editing && (
        <EventDialog
          key={editing === 'new' ? 'new' : editing.id}
          event={editing === 'new' || isShared(editing) ? null : editing}
          shared={editing !== 'new' && isShared(editing) ? editing : undefined}
          date={selected}
          onClose={() => setEditing(null)}
        />
      )}
      {viewingShared && <SharedDetailDialog entry={viewingShared} previewing={!vis.isSelf} onClose={() => setViewingShared(null)} />}
      {viewingShop && <ShoppingDetailDialog entry={viewingShop} onClose={() => setViewingShop(null)} />}
      {holidayOpen && <HolidayImportDialog onClose={() => setHolidayOpen(false)} />}
      {batchOpen && <BatchEventsDialog initialYear={ym.year} initialMonth={ym.month} onClose={() => setBatchOpen(false)} />}
    </>
  )
}
