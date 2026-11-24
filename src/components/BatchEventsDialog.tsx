import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { monthCells, shiftMonth, weekdayNames } from '../core/calendar'
import { TEXT_COLORS } from '../core/categories'
import { orderedKinds, PERSONAL_CALENDAR_ID, roleOf } from '../core/sharing'
import { useAppStore } from '../store/useAppStore'
import { useSpacesStore } from '../store/useSpacesStore'
import { AllDayToggle } from './AllDayToggle'
import { Button } from './Button'
import { ColorSwatches, TextColorSwatches } from './ColorSwatches'
import { Dialog } from './Dialog'
import { Field } from './Field'
import { TimeField } from './TimeField'
import { MonthNav } from './MonthNav'

/**
 * 選多個日期，一次建立相同的行程（舊版「任務批次輸入」）。
 * 防呆：
 * - 已選的日期（可以跨月份）依日期列成清單，每個都能單獨移除，送出前看得到實際會建立哪幾天
 * - 送出後由呼叫端顯示「復原」，一鍵刪除剛建立的行程（onCreated 帶回新行程的 id）
 *
 * 放在哪裡：「我的行事曆」或自己可以編輯（owner／editor）的共享空間，預設是行事曆上方目前選的分頁。
 * 選空間時建立的是該空間的一般共享行程（spaceId 綁定該空間、建立者是自己），可以直接編輯與刪除，不是忙碌投射。
 */
export function BatchEventsDialog({
  initialYear,
  initialMonth,
  initialTarget = PERSONAL_CALENDAR_ID,
  onClose,
  onCreated,
}: {
  initialYear: number
  initialMonth: number
  /** 預設放在哪裡：行事曆上方目前選的分頁（空間 id 或 PERSONAL_CALENDAR_ID）；不能編輯的空間會改成我的行事曆 */
  initialTarget?: string
  onClose: () => void
  /** spaceId：建立在共享空間時是空間 id，建立在我的行事曆時沒有 */
  onCreated?: (created: { ids: string[]; title: string; spaceId?: string }) => void
}) {
  const { t, i18n } = useTranslation()
  const addEvents = useAppStore((s) => s.addEvents)
  const addItem = useSpacesStore((s) => s.addItem)
  const selfId = useSpacesStore((s) => s.selfId)
  const allSpaces = useSpacesStore((s) => s.data.spaces)
  // 預覽其他成員的視角時不能新增到空間（只能檢視）
  const isSelf = useSpacesStore((s) => s.viewerId === s.selfId)
  const writable = isSelf ? allSpaces.filter((sp) => ['owner', 'editor'].includes(roleOf(sp, selfId) ?? '')) : []
  const [target, setTarget] = useState(() => (writable.some((sp) => sp.id === initialTarget) ? initialTarget : PERSONAL_CALENDAR_ID))
  const [ym, setYm] = useState({ year: initialYear, month: initialMonth })
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')
  const [allDay, setAllDay] = useState(false)
  const [bgColor, setBgColor] = useState('#eaf6ef')
  // 文字顏色和卡片背景分開選，十種莫蘭迪色；預設森林綠
  const [titleColor, setTitleColor] = useState<string>(TEXT_COLORS[1].color)
  const [dates, setDates] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState('')
  const dateFmt = new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'numeric', day: 'numeric', weekday: 'short' })

  const toggle = (iso: string) =>
    setDates((prev) => {
      const next = new Set(prev)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return setError(t('calendar.batchForm.nameRequired'))
    if (dates.size === 0) return setError(t('calendar.batchForm.datesRequired'))
    if (!allDay && end <= start) return setError(t('event.endBeforeStart'))
    const times = allDay ? { start: '', end: '' } : { start, end }
    const days = [...dates].sort()
    const space = writable.find((sp) => sp.id === target)
    if (!space) {
      const ids = addEvents(days.map((dateISO) => ({ title: title.trim(), dateISO, ...times, note: t('calendar.batchForm.note'), titleColor, bgColor })))
      onCreated?.({ ids, title: title.trim() })
      return onClose()
    }
    // 共享空間：每一天建立一筆該空間的共享行程；類型用空間建議的第一個，備註不寫「批次建立」（其他成員也看得到）
    try {
      const kind = orderedKinds(space.kind)[0]!
      const ids = days.map((dateISO) => addItem(space.id, { title: title.trim(), dateISO, ...times, kind, titleColor, bgColor }))
      onCreated?.({ ids, title: title.trim(), spaceId: space.id })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('calendar.batchForm.title')}>
      <form onSubmit={submit} className="grid gap-4">
        <div className="rounded-(--radius-control) border-l-4 px-4 py-3 text-sm font-bold" style={{ background: bgColor, color: titleColor, borderLeftColor: titleColor }}>
          {title.trim() || t('event.preview')}
        </div>
        {writable.length > 0 && (
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            {t('sharing.belongsTo')}
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="rounded-(--radius-control) border border-line bg-oat px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-sage"
            >
              <option value={PERSONAL_CALENDAR_ID}>{t('sharing.myCalendar')}</option>
              {writable.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}（{t(`sharing.spaceKind.${sp.kind}`)}）
                </option>
              ))}
            </select>
          </label>
        )}
        <Field label={t('calendar.batchForm.name')} placeholder={t('calendar.batchForm.namePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <div className="grid gap-2">
          <AllDayToggle checked={allDay} onChange={setAllDay} />
          {!allDay && (
            <div className="grid gap-3 min-[30rem]:grid-cols-2">
              <TimeField label={t('calendar.batchForm.start')} value={start} onChange={setStart} />
              <TimeField label={t('calendar.batchForm.end')} value={end} onChange={setEnd} />
            </div>
          )}
        </div>
        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('event.color')}
          <ColorSwatches label={t('event.color')} value={bgColor} onChange={(c) => setBgColor(c.bg)} />
        </div>
        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('event.textColor')}
          <TextColorSwatches label={t('event.textColor')} value={titleColor} onChange={setTitleColor} />
        </div>
        <fieldset className="grid gap-2 rounded-xl border border-line p-3">
          <legend className="px-1 text-xs font-semibold text-muted">{t('calendar.batchForm.pickDates')}</legend>
          <MonthNav year={ym.year} month={ym.month} onShift={(d) => setYm(shiftMonth(ym.year, ym.month, d))} />
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdayNames(i18n.resolvedLanguage).map((w, i) => (
              <span key={i} className="text-[length:calc(10px*var(--fs))] font-bold text-muted">
                {w}
              </span>
            ))}
            {monthCells(ym.year, ym.month).map((iso, i) =>
              iso ? (
                <button
                  key={iso}
                  type="button"
                  aria-pressed={dates.has(iso)}
                  aria-label={iso}
                  onClick={() => toggle(iso)}
                  className={`mx-auto grid size-9 place-items-center rounded-full text-xs font-semibold ${dates.has(iso) ? 'bg-sage text-white' : 'hover:bg-sage-light'}`}
                >
                  {Number(iso.slice(8))}
                </button>
              ) : (
                <span key={`pad-${i}`} />
              ),
            )}
          </div>
          <p className="text-[length:calc(11px*var(--fs))] text-muted">{t('calendar.batchForm.selected', { count: dates.size })}</p>
          {/* 已選日期清單（含其他月份），依日期排序，可以單獨移除 */}
          {dates.size > 0 && (
            <ul aria-label={t('calendar.batchForm.selectedList')} className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {[...dates].sort().map((iso) => {
                const label = dateFmt.format(new Date(`${iso}T00:00`))
                return (
                  <li key={iso} className="inline-flex items-center gap-1 rounded-full bg-sage-light py-0.5 pr-1 pl-2.5 text-[length:calc(11px*var(--fs))] font-semibold text-sage-dark">
                    {label}
                    <button type="button" aria-label={t('calendar.batchForm.removeDate', { date: label })} onClick={() => toggle(iso)} className="grid size-5 place-items-center rounded-full hover:bg-mint">
                      ×
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </fieldset>
        {error && <p className="-mt-2 text-xs text-[#c2583d]">{error}</p>}
        <div className="flex gap-2">
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit">{t('calendar.batchForm.submit', { count: dates.size })}</Button>
        </div>
      </form>
    </Dialog>
  )
}
