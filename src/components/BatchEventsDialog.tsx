import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { monthCells, shiftMonth, weekdayNames } from '../core/calendar'
import { TEXT_COLORS } from '../core/categories'
import { useAppStore } from '../store/useAppStore'
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
 */
export function BatchEventsDialog({
  initialYear,
  initialMonth,
  onClose,
  onCreated,
}: {
  initialYear: number
  initialMonth: number
  onClose: () => void
  onCreated?: (created: { ids: string[]; title: string }) => void
}) {
  const { t, i18n } = useTranslation()
  const addEvents = useAppStore((s) => s.addEvents)
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
    const ids = addEvents(days.map((dateISO) => ({ title: title.trim(), dateISO, ...times, note: t('calendar.batchForm.note'), titleColor, bgColor })))
    onCreated?.({ ids, title: title.trim() })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('calendar.batchForm.title')}>
      <form onSubmit={submit} className="grid gap-4">
        <div className="rounded-(--radius-control) border-l-4 px-4 py-3 text-sm font-bold" style={{ background: bgColor, color: titleColor, borderLeftColor: titleColor }}>
          {title.trim() || t('event.preview')}
        </div>
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
