import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toLocalISO } from '../core/date'
import type { CalendarEvent } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { Button } from './Button'
import { ColorSwatches, TextColorSwatches } from './ColorSwatches'
import { Dialog } from './Dialog'
import { Field } from './Field'

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
  const [error, setError] = useState('')
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const title = draft.title.trim()
    if (!title) return setError(t('event.titleRequired'))
    if (draft.start && draft.end && draft.end <= draft.start) return setError(t('event.endBeforeStart'))
    const data = { ...draft, title, note: draft.note.trim() }
    if (event) updateEvent(event.id, data)
    else addEvent(data)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={event ? t('event.editTitle') : t('event.newTitle')}>
      <form onSubmit={submit} className="grid gap-4">
        <div className="rounded-(--radius-control) border-l-4 px-4 py-3 text-sm font-bold" style={{ background: draft.bgColor, color: draft.titleColor, borderLeftColor: draft.titleColor }}>
          {draft.title.trim() || t('event.preview')}
        </div>
        <Field label={t('event.title')} placeholder={t('event.titlePlaceholder')} value={draft.title} onChange={(e) => set({ title: e.target.value })} autoFocus />
        <Field label={t('event.date')} type="date" value={draft.dateISO} onChange={(e) => set({ dateISO: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('event.start')} type="time" value={draft.start} onChange={(e) => set({ start: e.target.value })} />
          <Field label={t('event.end')} type="time" value={draft.end} onChange={(e) => set({ end: e.target.value })} />
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
