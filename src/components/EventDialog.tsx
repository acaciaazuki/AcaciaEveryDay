import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toLocalISO } from '../core/date'
import { EVENT_ICON_KEYS, eventIconOf, ICON_BG } from '../core/eventIcons'
import type { CalendarEvent } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { isAllDay } from '../core/time'
import { AllDayToggle } from './AllDayToggle'
import { Button } from './Button'
import { ColorSwatches, TextColorSwatches } from './ColorSwatches'
import { Dialog } from './Dialog'
import { EventIconArt } from './EventIcon'
import { Field } from './Field'
import { TimeField } from './TimeField'

type Draft = Omit<CalendarEvent, 'id'>

/** 行程新增 / 編輯，今天頁與行事曆共用 */
export function EventDialog({ event, date, onClose }: { event: CalendarEvent | null; date?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const addEvent = useAppStore((s) => s.addEvent)
  const updateEvent = useAppStore((s) => s.updateEvent)
  const removeEvent = useAppStore((s) => s.removeEvent)
  const [draft, setDraft] = useState<Draft>(
    event ?? { title: '', dateISO: date ?? toLocalISO(), start: '09:00', end: '10:00', note: '', titleColor: '#3d876c', bgColor: '#eaf6ef' },
  )
  // 整天：不存時間；切回來時還原原本填的時間
  const [allDay, setAllDay] = useState(() => !!event && isAllDay(event))
  const [times, setTimes] = useState(() => (event && !isAllDay(event) ? { start: event.start, end: event.end } : { start: '09:00', end: '10:00' }))
  const [error, setError] = useState('')
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const title = draft.title.trim()
    if (!title) return setError(t('event.titleRequired'))
    const { start, end } = allDay ? { start: '', end: '' } : times
    if (start && end && end <= start) return setError(t('event.endBeforeStart'))
    const data = { ...draft, title, start, end, note: draft.note.trim() }
    if (event) updateEvent(event.id, data)
    else addEvent(data)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={event ? t('event.editTitle') : t('event.newTitle')}>
      <form onSubmit={submit} className="grid gap-4">
        <div className="flex items-center gap-2.5 rounded-(--radius-control) border-l-4 px-4 py-3 text-sm font-bold" style={{ background: draft.bgColor, color: draft.titleColor, borderLeftColor: draft.titleColor }}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ background: ICON_BG[eventIconOf(draft)] }}>
            <EventIconArt icon={eventIconOf(draft)} size={20} />
          </span>
          {draft.title.trim() || t('event.preview')}
        </div>
        <Field label={t('event.title')} placeholder={t('event.titlePlaceholder')} value={draft.title} onChange={(e) => set({ title: e.target.value })} autoFocus />
        <Field label={t('event.date')} type="date" value={draft.dateISO} onChange={(e) => set({ dateISO: e.target.value })} />
        <div className="grid gap-2">
          <AllDayToggle checked={allDay} onChange={setAllDay} />
          {!allDay && (
            <div className="grid gap-3 min-[30rem]:grid-cols-2">
              <TimeField label={t('event.start')} value={times.start} onChange={(start) => setTimes((x) => ({ ...x, start }))} />
              <TimeField label={t('event.end')} value={times.end} onChange={(end) => setTimes((x) => ({ ...x, end }))} />
            </div>
          )}
        </div>
        {error && <p className="-mt-2 text-xs text-[#c2583d]">{error}</p>}
        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('event.color')}
          <ColorSwatches label={t('event.color')} value={draft.bgColor} onChange={(c) => set({ bgColor: c.bg })} />
        </div>
        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('event.textColor')}
          <TextColorSwatches label={t('event.textColor')} value={draft.titleColor} onChange={(c) => set({ titleColor: c })} />
        </div>
        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('event.icon')}
          <div role="radiogroup" aria-label={t('event.icon')} className="flex flex-wrap gap-2">
            <button
              type="button"
              role="radio"
              aria-checked={!draft.icon}
              onClick={() => set({ icon: undefined })}
              className={`h-9 rounded-full border px-3 text-xs font-bold ${!draft.icon ? 'border-sage bg-sage-light text-sage-dark ring-2 ring-sage/30' : 'border-line bg-oat text-muted'}`}
            >
              {t('event.iconAuto')}
            </button>
            {EVENT_ICON_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={draft.icon === k}
                aria-label={t(`icons.${k}`)}
                title={t(`icons.${k}`)}
                onClick={() => set({ icon: k })}
                className={`grid size-9 place-items-center rounded-full border ${draft.icon === k ? 'border-sage ring-2 ring-sage/30' : 'border-line'}`}
                style={{ background: ICON_BG[k] }}
              >
                <EventIconArt icon={k} size={22} />
              </button>
            ))}
          </div>
        </div>
        <Field label={t('event.note')} placeholder={t('event.notePlaceholder')} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
        <div className="mt-2 flex gap-2">
          {event && (
            <Button
              variant="danger"
              onClick={() => {
                removeEvent(event.id)
                onClose()
              }}
            >
              {t('common.delete')}
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit">{t('common.save')}</Button>
        </div>
      </form>
    </Dialog>
  )
}
