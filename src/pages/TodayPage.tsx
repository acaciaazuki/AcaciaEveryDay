import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import appI18n, { LANGUAGES } from '../i18n'
import { Link } from 'react-router'
import { Button } from '../components/Button'
import { Icon } from '../components/AcaciaIcons'
import { EventIconBadge } from '../components/EventIcon'
import { EventDialog } from '../components/EventDialog'
import { HolidayCard } from '../components/HolidayAgenda'
import { TodayHero } from '../components/TodayHero'
import { WeatherArt } from '../components/WeatherArt'
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
import { formatTime, formatTimeRange } from '../core/time'
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

/** 卡片：白色紙卡、細邊框加輕陰影，內距手機 22px、平板以上 28px */
const card = 'rounded-[20px] border border-line bg-paper px-5.5 py-6 shadow-card sm:p-7'
/** 卡片標題：17px、字重明確 */
const cardTitle = 'text-[length:calc(17px*var(--fs))] font-bold tracking-wide'

/**
 * 批次新增時自動寫進備註的「批次建立」（所有介面語言）在今天的時間軸上不顯示：
 * 它不是使用者寫的備註，只是建立方式的標記；行程資料與行事曆裡的備註欄位都不變。
 */
const BATCH_NOTES = new Set(LANGUAGES.map((l) => appI18n.getFixedT(l.code)('calendar.batchForm.note')))
const shownNote = (note: string) => (BATCH_NOTES.has(note.trim()) ? '' : note)
const NO_SHOPPING = new Map()
const NO_EVENTS: CalendarEvent[] = []
/** 卡片右上角與底部的小連結（查看完整日程、加一個行程、調整、全部、新增待辦），跟著字體設定縮放 */
const linkBtn = 'text-[length:calc(14px*var(--fs))] font-semibold text-sage hover:text-sage-dark'
/** 字級 14px（跟著字體設定縮放） */
const TEXT_14 = 'text-[length:calc(14px*var(--fs))]'

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

  return (
    // 內容最寬約 1180px、在可用寬度裡置中：寬螢幕兩側留白，不把卡片拉得扁長
    <div data-today-page className="mx-auto w-full max-w-[1180px]">
      <TodayHero
        dateLabel={dateLabel}
        greeting={title}
        night={offset === 0 && ['evening', 'night'].includes(greetingKey(now.getHours()))}
        onPrev={() => setOffset(offset - span)}
        onNext={() => setOffset(offset + span)}
        onBackToToday={offset !== 0 ? () => setOffset(0) : undefined}
        stats={[
          { value: rangeCount, label: t('today.statEvents') },
          { value: openTasks.length, label: t('today.statTasks') },
          { value: `${hours(freeMinutes)}h`, label: t('today.statFree') },
        ]}
        // 只在手機顯示（681px 以上改用側邊欄）；行事曆從底部導覽列進入，不另放「查看月曆」
        actions={
          vis.isSelf && (
            <Button size="page" onClick={() => setEditing('new')}>
              {t('today.addEvent')}
            </Button>
          )
        }
      />

      {/*
        三張卡片的排法：
        - 手機與中屏：時間軸 → 今天的節奏 → 順手完成，先看當下的行程，節奏與待辦在下方輔助
        - 1001–1279px：時間軸在上方橫跨整列，節奏、順手完成在下方並排
        - 1280px 以上：時間軸在左（約 70%），節奏與順手完成疊在右欄（340px）
      */}
      <div className="grid gap-6 min-[1001px]:grid-cols-2 min-[1280px]:grid-cols-[minmax(0,1fr)_340px] min-[1280px]:grid-rows-[auto_1fr] min-[1280px]:gap-7">
        <section className={`${card} min-[1001px]:col-[1/-1] min-[1280px]:col-[1] min-[1280px]:row-[1/3] min-[1280px]:self-start`}>
          <div className="mb-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <h2 className={cardTitle}>{offset === 0 && view === 'day' ? t('today.timeline') : t('today.timelineOther')}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
              <div role="group" aria-label={t('today.viewLabel')} className="flex rounded-full bg-[#f1efe9] p-1">
                {VIEWS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={`rounded-full px-3.5 py-1.5 font-bold whitespace-nowrap transition ${TEXT_14} ${view === v ? 'bg-sage-light text-sage-dark shadow-soft' : 'text-muted hover:text-ink'}`}
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
            <ul className="mb-4 grid gap-3">
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
            <ol className="grid gap-4">
              {items.map((it, i) => {
                const next = items.at(i + 1)
                if (it.kind === 'shopping')
                  return (
                    <li key={it.id} className="relative grid grid-cols-[calc(48px*var(--fs))_calc(36px*var(--fs))_1fr] items-start gap-x-3">
                      <TimelineTime hhmm={it.start} />
                      <ShoppingBadge className="relative z-10 ring-4 ring-paper" />
                      {next && <span aria-hidden className="absolute top-[calc(36px*var(--fs)+0.25rem)] -bottom-2 left-[calc(48px*var(--fs)+0.75rem+18px*var(--fs)-1px)] w-0.5 bg-[#e1eae5]" />}
                      <ShoppingCard entry={it.entry} onOpen={setViewingShop} />
                    </li>
                  )
                if (it.kind === 'shared')
                  return (
                    <li key={it.id} className="relative grid grid-cols-[calc(48px*var(--fs))_calc(36px*var(--fs))_1fr] items-start gap-x-3">
                      <TimelineTime hhmm={it.start} />
                      <EventIconBadge icon={it.shared.access === 'busy' || it.shared.maskedFields.includes('title') ? 'default' : eventIconOf(it.shared.item)} className="relative z-10 ring-4 ring-paper" />
                      {next && <span aria-hidden className="absolute top-[calc(36px*var(--fs)+0.25rem)] -bottom-2 left-[calc(48px*var(--fs)+0.75rem+18px*var(--fs)-1px)] w-0.5 bg-[#e1eae5]" />}
                      <SharedCard entry={it.shared} onOpen={openShared} />
                    </li>
                  )
                const e = it.event
                const gap = next && e.end && next.start > e.end ? diffMin(e.end, next.start) : 0
                return (
                  <li key={e.id} className="relative grid grid-cols-[calc(48px*var(--fs))_calc(36px*var(--fs))_1fr] items-start gap-x-3">
                    <TimelineTime hhmm={e.start} />
                    <EventIconBadge icon={eventIconOf(e)} className="relative z-10 ring-4 ring-paper" />
                    {/* 垂直時間軸線：從這顆徽章連到下一顆 */}
                    {next && <span aria-hidden className="absolute top-[calc(36px*var(--fs)+0.25rem)] -bottom-2 left-[calc(48px*var(--fs)+0.75rem+18px*var(--fs)-1px)] w-0.5 bg-[#e1eae5]" />}
                    <button
                      type="button"
                      onClick={() => setEditing(e)}
                      className="rounded-xl border-l-4 px-5 py-4 text-left transition hover:-translate-y-px"
                      style={{ background: e.bgColor || '#f1f5f1', borderLeftColor: e.titleColor || '#93b8a4' }}
                    >
                      <h3 className="text-[length:calc(15px*var(--fs))] font-bold" style={{ color: e.titleColor || 'var(--color-ink)' }}>
                        {e.title}
                      </h3>
                      <small className="mt-1.5 block text-[length:calc(12.5px*var(--fs))] text-muted tabular-nums">
                        {formatTimeRange(e.start, e.end) || t('event.allDay')} {shownNote(e.note) && `· ${e.note}`}
                      </small>
                    </button>
                    {gap >= 30 && (
                      <p className="col-start-3 flex items-center gap-1.5 py-1.5 pl-1 text-[length:calc(12px*var(--fs))] text-[#939b96]">
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
            <button type="button" onClick={() => setEditing('new')} className={`${linkBtn} mt-6`}>
              {t('today.addOne')}
            </button>
          )}
        </section>

        <section className={`${card} min-[1280px]:col-[2] min-[1280px]:row-[1]`}>
          <div className="mb-5 flex items-center justify-between gap-2">
            <h2 className={cardTitle}>{offset === 0 ? t('today.rhythm') : t('today.rhythmOn', { date: shortDate })}</h2>
            <button type="button" onClick={() => setEditingRhythm(true)} aria-label={t('rhythm.edit')} className={linkBtn}>
              {t('rhythm.editShort')}
            </button>
          </div>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <strong className="text-[length:calc(20px*var(--fs))] font-semibold tracking-wide tabular-nums">
                {formatTime(wake)} <span className="font-normal text-[#a8b1ac]">–</span> {formatTime(sleep)}
              </strong>
              <small className="mt-1 block text-[length:calc(12px*var(--fs))] text-muted">{t('today.rhythmRange')}</small>
            </div>
            <WeatherArt variant="night" cloud={false} className="w-[calc(52px*var(--fs))] shrink-0" />
          </div>
          <div
            role="meter"
            aria-label={t('today.busy', { h: hours(rhythm.busyMinutes) })}
            aria-valuemin={0}
            aria-valuemax={rhythm.totalMinutes}
            aria-valuenow={rhythm.busyMinutes}
            className="mb-4 h-2.5 overflow-hidden rounded-full bg-[#ebe8e0]"
          >
            <div className="h-full rounded-full bg-sage transition-[width] duration-500" style={{ width: `${(rhythm.busyMinutes / rhythm.totalMinutes) * 100}%` }} />
          </div>
          {/* 圖例：深綠＝已安排、淺色＝空檔 */}
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-2 text-[length:calc(12.5px*var(--fs))] text-[#66726c]">
            <span className="inline-flex items-center gap-2">
              <i aria-hidden className="size-2.5 rounded-full bg-sage" />
              {t('today.busy', { h: hours(rhythm.busyMinutes) })}
            </span>
            <span className="inline-flex items-center gap-2 font-semibold text-sage-dark">
              <i aria-hidden className="size-2.5 rounded-full bg-[#ebe8e0] ring-1 ring-[#d9d5ca]" />
              {t('today.free', { h: hours(rhythm.freeMinutes) })}
            </span>
          </div>
        </section>

        <QuickTasks className="min-[1280px]:col-[2] min-[1280px]:row-[2] min-[1280px]:self-start" />

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
    </div>
  )
}

/** 時間軸左側的時間（24 小時制） */
function TimelineTime({ hhmm }: { hhmm: string }) {
  const { t } = useTranslation()
  // 沒有時間的購物記帳當作整天
  if (!hhmm) return <span className="pt-1.5 text-xs leading-tight font-bold text-muted">{t('calendar.shopping.allDay')}</span>
  return (
    <time dateTime={hhmm} className="pt-2 text-[length:calc(13px*var(--fs))] leading-tight font-semibold text-[#6f7a74] tabular-nums">
      {formatTime(hhmm)}
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
                      style={{ background: e.bgColor || '#f1f5f1', borderLeftColor: e.titleColor || '#93b8a4' }}
                    >
                      <strong className="block text-[length:calc(13px*var(--fs))]" style={{ color: e.titleColor || 'var(--color-ink)' }}>
                        {e.title}
                      </strong>
                      <small className="text-[length:calc(11px*var(--fs))] text-muted">
                        {formatTimeRange(e.start, e.end) || t('event.allDay')} {shownNote(e.note) && `· ${e.note}`}
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

function QuickTasks({ className = '' }: { className?: string }) {
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
    <section className={`${card} ${className}`}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className={cardTitle}>{t('today.quick')}</h2>
        <Link to="/tasks" className={linkBtn}>
          {t('today.all')}
        </Link>
      </div>
      {lowCount > 0 && (
        <Link to="/tasks" className="mb-2 flex items-center gap-2 rounded-xl bg-[#eef6f0] px-3.5 py-2.5 text-[length:calc(12px*var(--fs))] font-semibold text-sage-dark hover:bg-sage-light">
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
              className="mb-2 flex items-center gap-3 rounded-xl px-3.5 py-3 last:mb-0"
              style={{ background: task.bgColor && task.bgColor !== '#ffffff' ? task.bgColor : '#f6f5f0', color: task.titleColor || undefined }}
            >
              <button type="button" aria-label={t('tasks.markDone')} onClick={() => toggleTask(task.id)} className="size-4.5 shrink-0 rounded-full border-2 border-[#cfd8d3] bg-paper/60 hover:border-sage" />
              <span className="text-[length:calc(14px*var(--fs))] font-semibold">{task.title}</span>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <form onSubmit={submit} className="mt-4 flex gap-2">
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
        <button type="button" onClick={() => setOpen(true)} className={`${linkBtn} mt-4`}>
          {t('today.quickAdd')}
        </button>
      )}
    </section>
  )
}
