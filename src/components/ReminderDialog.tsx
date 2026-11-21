import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { getLocationAdapter } from '../adapters/geofence'
import { hasCoords, parseCoords, splitItems } from '../core/reminders'
import { REMINDER_DAYS, REMINDER_RADII, type Reminder } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Field } from './Field'
import { reminderPreview, weekdayLabels } from './reminderText'

type Draft = Omit<Reminder, 'id'>
const blank: Draft = { place: '', radius: 300, trigger: 'leave', days: 'every', customDays: [], start: '', end: '', items: [], enabled: true }

const pill = (on: boolean) =>
  `rounded-full border px-4 py-2 text-xs font-bold transition ${on ? 'border-sage bg-sage-light text-sage-dark ring-2 ring-sage/25' : 'border-line bg-oat text-muted hover:bg-sage-light/60'}`

function Group<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={pill(value === o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 防遺漏提醒的新增 / 編輯 */
export function ReminderDialog({ reminder, onClose }: { reminder: Reminder | null; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const places = useAppStore((s) => s.places)
  const addReminder = useAppStore((s) => s.addReminder)
  const updateReminder = useAppStore((s) => s.updateReminder)
  const [draft, setDraft] = useState<Draft>(reminder ? { ...blank, ...reminder } : blank)
  const [coordText, setCoordText] = useState('')
  const [itemText, setItemText] = useState('')
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [coordMsg, setCoordMsg] = useState('')
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const days = weekdayLabels(i18n.resolvedLanguage)

  const pickFavorite = (id: string) => {
    const p = places.find((x) => x.id === id)
    if (!p) return
    const c = parseCoords(p.url)
    set({ place: p.name, placeId: p.id, ...(c ? { lat: c.lat, lng: c.lng } : {}) })
    setCoordMsg(c ? '' : t('reminders.form.coordsMissing'))
  }

  const fillCurrent = async () => {
    setLocating(true)
    setCoordMsg('')
    try {
      const fix = await getLocationAdapter().getCurrent()
      setDraft((d) => ({ ...d, lat: fix.lat, lng: fix.lng, place: d.place.trim() ? d.place : t('reminders.form.currentName') }))
    } catch (e) {
      setCoordMsg(e === 'denied' ? t('reminders.form.geoDenied') : t('reminders.form.geoFail'))
    } finally {
      setLocating(false)
    }
  }

  const applyCoordText = (text: string) => {
    setCoordText(text)
    if (!text.trim()) return setCoordMsg('')
    const c = parseCoords(text)
    if (c) {
      set({ lat: c.lat, lng: c.lng })
      setCoordMsg('')
      setCoordText('')
    } else setCoordMsg(t('reminders.form.coordsInvalid'))
  }

  const addItems = () => {
    const more = splitItems(itemText, draft.items)
    if (more.length) set({ items: [...draft.items, ...more] })
    setItemText('')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const pending = splitItems(itemText, draft.items)
    const items = [...draft.items, ...pending]
    if (!draft.place.trim()) return setError(t('reminders.form.placeRequired'))
    if (draft.days === 'custom' && draft.customDays.length === 0) return setError(t('reminders.form.customRequired'))
    if (items.length === 0) return setError(t('reminders.form.itemsRequired'))
    const data: Draft = { ...draft, place: draft.place.trim(), items }
    if (reminder) updateReminder(reminder.id, data)
    else addReminder(data)
    onClose()
  }

  const triggerOptions = [
    { value: 'arrive' as const, label: t('reminders.card.arrive') },
    { value: 'leave' as const, label: t('reminders.card.leave') },
  ]

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={reminder ? t('reminders.form.editTitle') : t('reminders.form.newTitle')}>
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-2">
          <Field label={t('reminders.form.place')} placeholder={t('reminders.form.placePlaceholder')} value={draft.place} onChange={(e) => set({ place: e.target.value })} autoFocus />
          <div className="flex flex-wrap gap-2">
            {places.length > 0 && (
              <select
                aria-label={t('reminders.form.fromFavorites')}
                value=""
                onChange={(e) => pickFavorite(e.target.value)}
                className="min-w-0 rounded-(--radius-control) border border-line bg-oat px-3 py-2 text-xs font-semibold text-muted outline-none focus:border-sage"
              >
                <option value="">{t('reminders.form.fromFavorites')}</option>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <Button variant="ghost" onClick={() => void fillCurrent()} disabled={locating}>
              {locating ? t('reminders.form.locating') : t('reminders.form.useCurrent')}
            </Button>
          </div>
          {hasCoords(draft) ? (
            <p className="flex flex-wrap items-center gap-2 text-xs text-sage-dark">
              ✓ {t('reminders.form.coordsSet', { lat: draft.lat.toFixed(5), lng: draft.lng.toFixed(5) })}
              <button type="button" className="font-semibold text-muted underline" onClick={() => set({ lat: undefined, lng: undefined })}>
                {t('reminders.form.clearCoords')}
              </button>
            </p>
          ) : (
            <Field label={t('reminders.form.coords')} placeholder="25.0330, 121.5654" value={coordText} onChange={(e) => applyCoordText(e.target.value)} />
          )}
          {coordMsg && <p className="text-xs text-[#c2583d]">{coordMsg}</p>}
          {!hasCoords(draft) && !coordMsg && <p className="text-xs text-muted">{t('reminders.form.coordsMissing')}</p>}
        </div>

        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('reminders.form.radius')}
          <Group label={t('reminders.form.radius')} value={draft.radius} options={REMINDER_RADII.map((m) => ({ value: m, label: `${m}m` }))} onChange={(radius) => set({ radius })} />
        </div>

        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('reminders.form.trigger')}
          <Group label={t('reminders.form.trigger')} value={draft.trigger} options={triggerOptions} onChange={(trigger) => set({ trigger })} />
        </div>

        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('reminders.form.days')}
          <Group label={t('reminders.form.days')} value={draft.days} options={REMINDER_DAYS.map((d) => ({ value: d, label: t(`reminders.days.${d}`) }))} onChange={(d) => set({ days: d })} />
          {draft.days === 'custom' && (
            <div role="group" aria-label={t('reminders.days.custom')} className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const on = draft.customDays.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ customDays: on ? draft.customDays.filter((x) => x !== d) : [...draft.customDays, d].sort() })}
                    className={`size-9 rounded-full border text-xs font-bold ${on ? 'border-sage bg-sage text-white' : 'border-line bg-oat text-muted'}`}
                  >
                    {days[d]}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="grid gap-1.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('reminders.form.start')} type="time" value={draft.start} onChange={(e) => set({ start: e.target.value })} />
            <Field label={t('reminders.form.end')} type="time" value={draft.end} onChange={(e) => set({ end: e.target.value })} />
          </div>
          <p className="text-[length:calc(11px*var(--fs))] text-muted">{t('reminders.form.timeHint')}</p>
        </div>

        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          <label htmlFor="reminder-item">{t('reminders.form.items')}</label>
          <div className="flex gap-2">
            <input
              id="reminder-item"
              value={itemText}
              placeholder={t('reminders.form.itemPlaceholder')}
              onChange={(e) => setItemText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addItems()
                }
              }}
              className="min-w-0 flex-1 rounded-(--radius-control) border border-line bg-oat px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-sage"
            />
            <Button variant="ghost" onClick={addItems}>
              {t('reminders.form.addItem')}
            </Button>
          </div>
          {draft.items.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {draft.items.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    aria-label={t('reminders.form.removeItem', { item })}
                    onClick={() => set({ items: draft.items.filter((x) => x !== item) })}
                    className="rounded-full bg-sage-light px-3 py-1.5 text-xs font-semibold text-sage-dark hover:bg-mint"
                  >
                    {item} ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-1 rounded-(--radius-control) bg-weekend px-4 py-3">
          <span className="text-[length:calc(11px*var(--fs))] font-bold text-muted">{t('reminders.form.preview')}</span>
          <p data-testid="reminder-preview" className="text-[length:calc(13px*var(--fs))] leading-relaxed font-semibold">
            {reminderPreview(t, i18n.resolvedLanguage, { ...draft, items: [...draft.items, ...splitItems(itemText, draft.items)] })}
          </p>
        </div>

        {error && <p className="-mt-2 text-xs text-[#c2583d]">{error}</p>}
        <div className="mt-1 flex gap-2">
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit">{t('common.save')}</Button>
        </div>
      </form>
    </Dialog>
  )
}
