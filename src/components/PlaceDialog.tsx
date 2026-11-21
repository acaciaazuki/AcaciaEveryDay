import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { PlacesSearchError, searchPlaces } from '../adapters/placesSearch'
import { PLACE_CATEGORIES, PLACE_CATEGORY_KEYS, type PlaceCategory } from '../core/categories'
import { buildPlaceNote, detectPlaceCategory, formatOpeningHours, placeName, type PlaceNoteLabels, type PlaceResult } from '../core/places'
import type { Place } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { Button } from './Button'
import { ColorSwatches } from './ColorSwatches'
import { Dialog } from './Dialog'
import { Field } from './Field'
import { TextArea } from './TextArea'

type Draft = Omit<Place, 'id'>
const blank: Draft = { name: '', cat: 'restaurant', address: '', hours: '', note: '', url: '', bgColor: '#ffffff' }

type SearchState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'results'; items: PlaceResult[] } | { kind: 'message'; text: string }

export function PlaceDialog({ place, onClose }: { place: Place | null; onClose: () => void }) {
  const { t } = useTranslation()
  const addPlace = useAppStore((s) => s.addPlace)
  const updatePlace = useAppStore((s) => s.updatePlace)
  const removePlace = useAppStore((s) => s.removePlace)
  const [draft, setDraft] = useState<Draft>(place ? { ...blank, ...place } : blank)
  const [q, setQ] = useState('')
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' })
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const labels: PlaceNoteLabels = {
    closedDays: (days) => t('places.note.closedDays', { days }),
    noClosedDays: t('places.note.noClosedDays'),
    noHours: t('places.note.noHours'),
    rating: (rating, count) => (count ? t('places.note.ratingCount', { rating, count }) : t('places.note.rating', { rating })),
    phone: (phone) => t('places.note.phone', { phone }),
    clinicTip: t('places.note.clinicTip'),
    intro: (text) => t('places.note.intro', { text }),
    highlights: (text) => t('places.note.highlights', { text }),
    reviews: (quotes) => `${t('places.note.reviews')}\n${quotes.map((x) => `「${x}」`).join('\n')}`,
  }

  const fill = (p: PlaceResult) => {
    const name = placeName(p)
    const cat = detectPlaceCategory(name, p.types)
    set({
      name,
      cat,
      address: p.formattedAddress ?? '',
      url: p.googleMapsUri ?? '',
      hours: formatOpeningHours(p.regularOpeningHours?.weekdayDescriptions ?? [], labels),
      note: buildPlaceNote(p, cat, labels),
    })
    setSearch({ kind: 'message', text: t('places.form.filled', { cat: t(`placeCat.${cat}`) }) })
  }

  const runSearch = async () => {
    const query = q.trim()
    if (!query) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setSearch({ kind: 'loading' })
    try {
      const items = await searchPlaces(query, ac.signal)
      if (items.length === 0) setSearch({ kind: 'message', text: t('places.form.noResults', { q: query }) })
      else if (items.length === 1) fill(items[0])
      else setSearch({ kind: 'results', items })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setSearch({ kind: 'message', text: e instanceof PlacesSearchError && e.message !== 'network' ? e.message : t('places.form.searchFailed') })
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const name = draft.name.trim()
    if (!name) return setError(t('places.form.nameRequired'))
    const data = { ...draft, name, address: draft.address.trim(), hours: draft.hours.trim(), note: draft.note.trim(), url: draft.url.trim() }
    if (place) updatePlace(place.id, data)
    else addPlace(data)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={place ? t('places.form.editTitle') : t('places.form.newTitle')}>
      <form onSubmit={submit} className="grid gap-4">
        {!place && (
          <div className="grid gap-1.5">
            <label htmlFor="place-search" className="text-xs font-semibold text-muted">
              {t('places.form.search')}
            </label>
            <div className="flex gap-2">
              <input
                id="place-search"
                value={q}
                placeholder={t('places.form.searchPlaceholder')}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void runSearch()
                  }
                }}
                className="min-w-0 flex-1 rounded-(--radius-control) border border-line bg-oat px-3 py-2.5 text-sm outline-none focus:border-sage"
              />
              <Button onClick={() => void runSearch()} disabled={search.kind === 'loading'}>
                {t('places.form.searchBtn')}
              </Button>
            </div>
            <div aria-live="polite">
              {search.kind === 'loading' && <p className="text-[length:calc(11px*var(--fs))] text-muted">{t('places.form.searching', { q: q.trim() })}</p>}
              {search.kind === 'message' && <p className="text-[length:calc(11px*var(--fs))] text-sage-dark">{search.text}</p>}
              {search.kind === 'results' && (
                <ul className="mt-1 grid max-h-48 overflow-y-auto rounded-xl border border-line">
                  {search.items.map((p, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => fill(p)} className="w-full border-b border-line px-3 py-2 text-left last:border-0 hover:bg-sage-light">
                        <strong className="block text-[length:calc(13px*var(--fs))]">{placeName(p)}</strong>
                        <small className="text-[length:calc(11px*var(--fs))] text-muted">{p.formattedAddress}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        <Field label={t('places.form.name')} placeholder={t('places.form.namePlaceholder')} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        {error && <p className="-mt-2 text-xs text-[#c2583d]">{error}</p>}
        <Field label={t('places.form.address')} value={draft.address} onChange={(e) => set({ address: e.target.value })} />
        <label className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('places.form.cat')}
          <select
            className="rounded-(--radius-control) border border-line bg-oat px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-sage"
            value={draft.cat}
            onChange={(e) => set({ cat: e.target.value as PlaceCategory })}
          >
            {PLACE_CATEGORY_KEYS.map((c) => (
              <option key={c} value={c}>
                {PLACE_CATEGORIES[c].icon} {t(`placeCat.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <TextArea label={t('places.form.hours')} rows={4} placeholder={t('places.form.hoursPlaceholder')} value={draft.hours} onChange={(e) => set({ hours: e.target.value })} />
        <TextArea label={t('places.form.note')} rows={3} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('places.form.color')}
          <ColorSwatches label={t('places.form.color')} value={draft.bgColor} onChange={(c) => set({ bgColor: c.bg })} />
        </div>
        <div className="mt-2 flex gap-2">
          {place && (
            <Button
              variant="danger"
              onClick={() => {
                if (!window.confirm(t('places.form.deleteConfirm'))) return
                removePlace(place.id)
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
