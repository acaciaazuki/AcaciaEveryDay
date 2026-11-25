import { useCallback, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../components/AcaciaIcons'
import { BatchEventsDialog } from '../components/BatchEventsDialog'
import { Toast } from '../components/Toast'
import { TrashDialog } from '../components/TrashDialog'
import { Button } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { EventDialog } from '../components/EventDialog'
import { HolidayCard, HolidayChip, HolidayImportDialog } from '../components/HolidayAgenda'
import { MonthNav } from '../components/MonthNav'
import { PageHead } from '../components/PageHead'
import { ShoppingCard, ShoppingChip, ShoppingDetailDialog } from '../components/ShoppingAgenda'
import { monthCells, shiftMonth, weekdayNames } from '../core/calendar'
import { toLocalISO } from '../core/date'
import type { CalendarEvent } from '../core/schema'
import { formatTime, formatTimeRange } from '../core/time'
import { agendaOn, type ShoppingEntry } from '../core/shoppingAgenda'
import { useNow } from '../hooks/useNow'
import { SHOP_STYLE, useShoppingByDate } from '../hooks/useShoppingAgenda'
import { useOpenFromUrl } from '../hooks/useOpenFromUrl'
import { useChipCapacity } from '../hooks/useChipCapacity'
import { HOLIDAY_STYLE, holidayStyle, useHolidaysByDate } from '../hooks/useHolidays'
import { useAppStore } from '../store/useAppStore'
import { CalendarBatchBar } from '../components/CalendarBatchBar'
import { TriCheckbox } from '../components/TriCheckbox'
import { deleteSelection, personalKey, type BatchSelectable } from '../store/calendarBatch'
import { liveEvents } from '../core/trash'

// 每天最多顯示的行程標籤數，超過的折成「還有 X 個」；桌面滿版時改依格子實際高度計算
const MAX_CHIPS = 6

export function CalendarPage() {
  const { t, i18n } = useTranslation()
  // 「最近刪除」裡的行程不顯示
  const events = useAppStore((s) => liveEvents(s.events))
  const now = useNow()
  const todayISO = toLocalISO(now)
  const [ym, setYm] = useState(() => ({ year: now.getFullYear(), month: now.getMonth() }))
  const [selected, setSelected] = useState(todayISO)
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null)
  // 點日期打開「這一天」：列出當天全部行程與新增入口（取代原本右側的當日行程面板，手機也靠它點開行程）
  const [dayOpen, setDayOpen] = useState(false)
  const openDay = (iso: string) => {
    setSelected(iso)
    setDayOpen(true)
  }
  /** 從「這一天」裡點開某一筆時，先收起這一天，避免兩層對話框疊在一起 */
  const fromDay =
    <T,>(fn: (x: T) => void) =>
    (x: T) => {
      setDayOpen(false)
      fn(x)
    }
  const [batchOpen, setBatchOpen] = useState(false)
  // 「最近刪除」：刪掉的行程保留 30 天
  const [trashOpen, setTrashOpen] = useState(false)
  // 批次建立後的提示：可以一鍵復原（刪除剛建立的行程）
  // 提示（批次建立、批次刪除）：undo 有值時顯示「復原」
  const [batchToast, setBatchToast] = useState<{ message: string; undo?: () => void; undone?: string } | null>(null)
  const discardEvents = useAppStore((s) => s.discardEvents)
  // 批次管理模式：行程前出現勾選框、每天有「全選當天」、底部有操作列；一般瀏覽時都不顯示
  const [managing, setManaging] = useState(false)
  const [picked, setPicked] = useState<Map<string, BatchSelectable>>(() => new Map())
  const closeBatchToast = useCallback(() => setBatchToast(null), [])
  // 匯入的國定假日：唯讀，排在每天最前面
  const holidaysByDate = useHolidaysByDate()
  const [holidayOpen, setHolidayOpen] = useState(false)
  // 購物記帳連動進來的行程：只能看，點開是唯讀詳情
  const shopByDate = useShoppingByDate()
  const [viewingShop, setViewingShop] = useState<ShoppingEntry | null>(null)
  // ⌘K 搜尋結果導過來時開啟
  useOpenFromUrl(events, (e) => {
    const [y, m] = e.dateISO.split('-').map(Number)
    if (y && m) setYm({ year: y, month: m - 1 })
    if (e.dateISO) setSelected(e.dateISO)
    setEditing(e)
  })

  const cells = monthCells(ym.year, ym.month)
  // 當月有幾週（4–6），桌面滿版時每週平均分配高度
  const weeks = Math.ceil(cells.length / 7)
  const gridRef = useRef<HTMLDivElement>(null)
  const maxChips = useChipCapacity(gridRef, MAX_CHIPS, weeks)
  const dayItems = agendaOn(events, shopByDate, selected)

  /** 某一天可以批次操作的行程：我的行事曆的行程（購物連動排除） */
  const selectablesOn = (iso: string): BatchSelectable[] =>
    agendaOn(events, shopByDate, iso).flatMap((it): BatchSelectable[] => (it.kind === 'event' ? [{ key: personalKey(it.event.id), event: it.event }] : []))
  const togglePick = (x: BatchSelectable) =>
    setPicked((prev) => {
      const next = new Map(prev)
      if (next.has(x.key)) next.delete(x.key)
      else next.set(x.key, x)
      return next
    })
  /** 全選當天：勾選時把當天可以操作的全部加入；取消時全部移除 */
  const pickDay = (list: BatchSelectable[], on: boolean) =>
    setPicked((prev) => {
      const next = new Map(prev)
      for (const x of list) {
        if (on) next.set(x.key, x)
        else next.delete(x.key)
      }
      return next
    })
  const dayState = (list: BatchSelectable[]): 'all' | 'some' | 'none' => {
    const n = list.filter((x) => picked.has(x.key)).length
    return n === 0 ? 'none' : n === list.length ? 'all' : 'some'
  }
  const stopManaging = () => {
    setManaging(false)
    setPicked(new Map())
  }
  const runDelete = () => {
    const r = deleteSelection([...picked.values()])
    setPicked(new Map())
    setBatchToast({ message: t('calendar.manage.deleted', { count: r.count }), undo: r.undo, undone: t('calendar.manage.undone') })
  }
  const dayHolidays = holidaysByDate.get(selected) ?? []
  const selectedLabel = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'full' }).format(new Date(`${selected}T00:00`))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHead
        title={t('calendar.title')}
        actions={
          <>
              <Button variant="ghost" size="page" onClick={() => setHolidayOpen(true)}>
                {t('holidays.open')}
              </Button>
              <Button variant="ghost" size="page" onClick={() => setBatchOpen(true)}>
                {t('calendar.batch')}
              </Button>
              <Button variant="ghost" size="page" aria-pressed={managing} onClick={() => (managing ? stopManaging() : setManaging(true))} className={managing ? 'border-sage! bg-sage-light! text-sage-dark' : ''}>
                {managing ? t('calendar.manage.done') : t('calendar.manage.start')}
              </Button>
              <Button variant="ghost" size="page" onClick={() => setTrashOpen(true)}>
                {t('trash.open')}
              </Button>
              <Button size="page" onClick={() => setEditing('new')}>
                {t('calendar.add')}
              </Button>
          </>
        }
      />
      {managing && <p data-manage-hint className="-mt-2 mb-3 text-xs text-muted">{t('calendar.manage.hint')}</p>}

      {/* 所有寬度：月曆卡片與日期網格向下撐滿視窗剩餘高度（手機到底部導覽列上方、桌面到視窗底部 24px） */}
      <section className="flex min-h-0 flex-1 flex-col rounded-(--radius-card) bg-paper p-4 shadow-card sm:p-5 min-[1001px]:p-6">
          <MonthNav
            year={ym.year}
            month={ym.month}
            onShift={(d) => setYm(shiftMonth(ym.year, ym.month, d))}
            onToday={() => {
              setYm({ year: now.getFullYear(), month: now.getMonth() })
              setSelected(todayISO)
            }}
          />
          <div
            ref={gridRef}
            role="grid"
            data-weeks={weeks}
            style={{ '--weeks': weeks } as CSSProperties}
            // 週列依當月週數平均分配（1fr）；最小高度：手機 3.25rem、平板 5rem、桌面 4.5rem，極矮的視窗才會整頁捲動
            className="mt-4 grid flex-1 grid-cols-7 grid-rows-[auto_repeat(var(--weeks),minmax(var(--row-min),1fr))] gap-1 [--row-min:3.25rem] min-[640px]:[--row-min:5rem] min-[1001px]:[--row-min:4.5rem]!"
          >
            {weekdayNames(i18n.resolvedLanguage).map((w, i) => (
              <div key={i} role="columnheader" className="pb-1 text-center text-[length:calc(11px*var(--fs))] font-bold text-muted">
                {w}
              </div>
            ))}
            {cells.map((iso, i) => {
              if (!iso) return <div key={`pad-${i}`} />
              // 每週從星期日開始，第 0 欄是日、第 6 欄是六
              const weekend = i % 7 === 0 || i % 7 === 6
              const evs = agendaOn(events, shopByDate, iso)
              const hols = holidaysByDate.get(iso) ?? []
              // 放假日（不含補班）的日期數字用假日色
              const isHoliday = hols.some((h) => !h.work)
              const chipRoom = Math.max(0, maxChips - hols.length)
              const isSel = iso === selected
              const isToday = iso === todayISO
              const pickable = managing ? selectablesOn(iso) : []
              return (
                <div
                  key={iso}
                  role="gridcell"
                  aria-selected={isSel}
                  tabIndex={0}
                  // contain:size 讓格子內容不影響列高，週列只依 1fr 平均分配（也避免「標籤數 ↔ 格子高度」互相撐大）。
                  // p-2 加 !：Tailwind 產生的 CSS 裡 sm: 排在 min-[1001px]: 之後，不加會被 sm:p-1.5 蓋掉
                  aria-label={t('calendar.openDay', { date: iso })}
                  onClick={() => openDay(iso)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    openDay(iso)
                  }}
                  className={`min-h-0 cursor-pointer overflow-hidden rounded-lg border p-1 text-left transition [contain:size] sm:p-1.5 min-[1001px]:p-2! ${
                    isSel ? `border-sage ${weekend ? 'bg-weekend' : 'bg-sage-light/60'}` : `border-transparent ${weekend ? 'bg-weekend hover:bg-weekend-hover' : 'hover:bg-oat'}`
                  }`}
                >
                  <div className="mb-1 flex items-center gap-1">
                    <div
                      className={`grid size-6 place-items-center rounded-full text-xs font-bold ${isToday ? 'bg-sage text-white' : ''}`}
                      style={isHoliday && !isToday ? { color: HOLIDAY_STYLE.day } : undefined}
                    >
                      {Number(iso.slice(8))}
                    </div>
                    {/* 批次管理：全選當天（三態）；當天沒有可以操作的行程時不顯示 */}
                    {pickable.length > 0 && <TriCheckbox state={dayState(pickable)} label={t('calendar.manage.selectDay', { date: iso })} onChange={(on) => pickDay(pickable, on)} />}
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
                        style={{ background: it.kind === 'shopping' ? SHOP_STYLE.dot : it.event.titleColor || '#4a987b' }}
                      />
                    ))}
                  </div>
                  <div className="hidden gap-px sm:grid">
                    {hols.map((h) => (
                      <HolidayChip key={h.id} holiday={h} />
                    ))}
                    {evs.slice(0, chipRoom).map((it) => {
                      if (managing) {
                        const x = it.kind === 'event' ? pickable.find((p) => p.key === personalKey(it.event.id)) : undefined
                        if (x) return <PickChip key={it.id} item={x} picked={picked.has(x.key)} onToggle={() => togglePick(x)} />
                      }
                      // 批次管理時不能選的（購物連動）淡化、不能點
                      if (it.kind === 'shopping') {
                        const chip = <ShoppingChip key={it.id} entry={it.entry} onOpen={setViewingShop} />
                        return managing ? <span key={it.id} data-unpickable className="pointer-events-none grid opacity-40">{chip}</span> : chip
                      }
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
                    {evs.length > chipRoom && (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation()
                          openDay(iso)
                        }}
                        className="justify-self-start rounded px-1.5 text-[length:calc(10px*var(--fs))] text-muted hover:bg-sage-light hover:text-sage-dark"
                      >
                        {t('calendar.more', { count: evs.length - chipRoom })}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
      </section>

      {dayOpen && (
        <Dialog open onOpenChange={(o) => !o && setDayOpen(false)} title={selectedLabel}>
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
          ) : managing ? (
            <ManageDayList
              items={dayItems}
              pickable={selectablesOn(selected)}
              picked={picked}
              dayLabel={selectedLabel}
              dayState={dayState}
              onToggle={togglePick}
              onPickDay={pickDay}
            />
          ) : (
            <ul className="grid gap-2">
              {dayItems.map((it) => {
                if (it.kind === 'shopping')
                  return (
                    <li key={it.id}>
                      <ShoppingCard compact entry={it.entry} onOpen={fromDay(setViewingShop)} />
                    </li>
                  )
                const e = it.event
                return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => fromDay(setEditing)(e)}
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
          {!managing && (
            <button type="button" onClick={() => fromDay(setEditing)('new')} className="mt-3 text-xs font-semibold text-sage hover:text-sage-dark">
              {t('calendar.addOnDay')}
            </button>
          )}
        </Dialog>
      )}

      {editing && (
        <EventDialog
          key={editing === 'new' ? 'new' : editing.id}
          event={editing === 'new' ? null : editing}
          date={selected}
          onClose={() => setEditing(null)}
        />
      )}
      {viewingShop && <ShoppingDetailDialog entry={viewingShop} onClose={() => setViewingShop(null)} />}
      {holidayOpen && <HolidayImportDialog onClose={() => setHolidayOpen(false)} />}
      {batchOpen && (
        <BatchEventsDialog
          initialYear={ym.year}
          initialMonth={ym.month}
          onClose={() => setBatchOpen(false)}
          onCreated={({ ids, title }) =>
            setBatchToast({
              message: t('calendar.batchForm.created', { count: ids.length, title }),
              // 取消剛建立的行程：直接移除，不進「最近刪除」
              undo: () => discardEvents(ids),
              undone: t('calendar.batchForm.undone', { count: ids.length }),
            })
          }
        />
      )}
      {managing && (
        <>
          {/* 預留操作列的高度，月曆底部不會被擋住 */}
          <div aria-hidden className="h-20 shrink-0" />
          <CalendarBatchBar count={picked.size} onDelete={runDelete} onClear={() => setPicked(new Map())} onDone={stopManaging} />
        </>
      )}
      {trashOpen && <TrashDialog onClose={() => setTrashOpen(false)} />}
      {batchToast && (
        <Toast
          key={batchToast.message}
          message={batchToast.message}
          onDone={closeBatchToast}
          raised={managing}
          // 有復原按鈕時多留一點時間
          duration={batchToast.undo ? 8000 : 2600}
          action={
            batchToast.undo && {
              label: t('calendar.batchForm.undo'),
              onClick: () => {
                batchToast.undo!()
                // 按鈕會先關掉這個提示，下一輪再顯示「已復原」
                const undone = batchToast.undone
                if (undone) setTimeout(() => setBatchToast({ message: undone }))
              },
            }
          }
        />
      )}
    </div>
  )
}

/** 批次管理：行程標籤（月曆格子裡），前面有勾選框；點一下切換選取，不會打開編輯 */
function PickChip({ item, picked, onToggle }: { item: BatchSelectable; picked: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  const { title, start, bg, fg } = pickView(item)
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={picked}
      aria-label={t('calendar.manage.select', { title })}
      data-pick={item.key}
      onClick={(ev) => {
        ev.stopPropagation()
        onToggle()
      }}
      className={`flex items-center gap-1 truncate rounded px-1 py-px text-left text-[length:calc(10px*var(--fs))] leading-4 font-semibold ${picked ? 'ring-1 ring-sage' : ''}`}
      style={{ background: bg, color: fg }}
    >
      <span aria-hidden className={`grid size-3 shrink-0 place-items-center rounded-sm border ${picked ? 'border-sage bg-sage text-white' : 'border-[#b9c4be] bg-paper'}`}>
        {picked && <Icon name="check" className="size-full" />}
      </span>
      <span className="truncate">
        {start && `${formatTime(start)} `}
        {title}
      </span>
    </button>
  )
}

/** 標籤與清單共用：顯示用的名稱、時間與顏色 */
function pickView(item: BatchSelectable) {
  const e = item.event
  return { title: e.title, start: e.start, end: e.end, bg: e.bgColor || '#eaf6ef', fg: e.titleColor || '#263633' }
}

/** 批次管理：「這一天」的清單，可以選取的行程前面有勾選框，最上面是全選當天；不能選的淡化顯示 */
function ManageDayList({
  items,
  pickable,
  picked,
  dayLabel,
  dayState,
  onToggle,
  onPickDay,
}: {
  items: ReturnType<typeof agendaOn>
  pickable: BatchSelectable[]
  picked: Map<string, BatchSelectable>
  dayLabel: string
  dayState: (list: BatchSelectable[]) => 'all' | 'some' | 'none'
  onToggle: (x: BatchSelectable) => void
  onPickDay: (list: BatchSelectable[], on: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-2">
      {pickable.length > 0 && (
        <label className="flex items-center gap-2 text-xs font-semibold text-muted">
          <TriCheckbox state={dayState(pickable)} label={t('calendar.manage.selectDay', { date: dayLabel })} onChange={(on) => onPickDay(pickable, on)} />
          {t('calendar.manage.selectAllDay')}
        </label>
      )}
      <ul className="grid gap-2">
        {items.map((it) => {
          const x = it.kind === 'event' ? pickable.find((p) => p.key === personalKey(it.event.id)) : undefined
          if (!x)
            return (
              <li key={it.id} data-unpickable className="pointer-events-none opacity-40">
                {it.kind === 'shopping' ? <ShoppingCard compact entry={it.entry} onOpen={() => {}} /> : null}
              </li>
            )
          const v = pickView(x)
          return (
            <li key={it.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border-l-4 px-3 py-2.5" style={{ background: v.bg, borderLeftColor: v.fg }}>
                <input type="checkbox" checked={picked.has(x.key)} onChange={() => onToggle(x)} aria-label={t('calendar.manage.select', { title: v.title })} className="size-4 accent-sage" />
                <span className="min-w-0">
                  <strong className="block text-[length:calc(13px*var(--fs))]" style={{ color: v.fg }}>
                    {v.title}
                  </strong>
                  <small className="text-[length:calc(11px*var(--fs))] text-muted">
                    {formatTimeRange(v.start, v.end) || t('event.allDay')}
                  </small>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
