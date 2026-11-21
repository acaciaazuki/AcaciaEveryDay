import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { monthCells, shiftMonth, weekdayNames } from '../core/calendar'
import { useAppStore } from '../store/useAppStore'
import { Button } from './Button'
import { ColorSwatches } from './ColorSwatches'
import { Dialog } from './Dialog'
import { Field } from './Field'
import { MonthNav } from './MonthNav'

/** 選多個日期，一次建立相同的行程（舊版「任務批次輸入」） */
export function BatchEventsDialog({ initialYear, initialMonth, onClose }: { initialYear: number; initialMonth: number; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const addEvents = useAppStore((s) => s.addEvents)
  const [ym, setYm] = useState({ year: initialYear, month: initialMonth })
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')
  const [color, setColor] = useState({ bg: '#eaf6ef', txt: '#3d876c' })
  const [dates, setDates] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState('')

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
    if (end <= start) return setError(t('event.endBeforeStart'))
    addEvents(
      [...dates].sort().map((dateISO) => ({ title: title.trim(), dateISO, start, end, note: t('calendar.batchForm.note'), titleColor: color.txt, bgColor: color.bg })),
    )
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('calendar.batchForm.title')}>
      <form onSubmit={submit} className="grid gap-4">
        <Field label={t('calendar.batchForm.name')} placeholder={t('calendar.batchForm.namePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('calendar.batchForm.start')} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          <Field label={t('calendar.batchForm.end')} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('calendar.batchForm.color')}
          <ColorSwatches label={t('calendar.batchForm.color')} value={color.bg} onChange={setColor} />
        </div>
        <fieldset className="grid gap-2 rounded-xl border border-line p-3">
          <legend className="px-1 text-xs font-semibold text-muted">{t('calendar.batchForm.pickDates')}</legend>
          <MonthNav year={ym.year} month={ym.month} onShift={(d) => setYm(shiftMonth(ym.year, ym.month, d))} />
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdayNames(i18n.resolvedLanguage).map((w, i) => (
              <span key={i} className="text-[10px] font-bold text-muted">
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
          <p className="text-[11px] text-muted">{t('calendar.batchForm.selected', { count: dates.size })}</p>
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
