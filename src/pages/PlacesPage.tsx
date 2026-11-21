import { Icon } from '../components/AcaciaIcons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/Button'
import { PageHead } from '../components/PageHead'
import { PlaceDialog } from '../components/PlaceDialog'
import { PLACE_CATEGORIES, PLACE_CATEGORY_KEYS, type PlaceCategory } from '../core/categories'
import { mapsUrl } from '../core/places'
import type { Place } from '../core/schema'
import { useOpenFromUrl } from '../hooks/useOpenFromUrl'
import { useAppStore } from '../store/useAppStore'

export function PlacesPage() {
  const { t } = useTranslation()
  const places = useAppStore((s) => s.places)
  const [cat, setCat] = useState<PlaceCategory | 'all'>('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Place | 'new' | null>(null)
  useOpenFromUrl(places, setEditing)

  const needle = q.trim().toLowerCase()
  const shown = places.filter(
    (p) => (cat === 'all' || p.cat === cat) && (!needle || [p.name, p.address, p.note].some((s) => s.toLowerCase().includes(needle))),
  )

  return (
    <>
      <PageHead eyebrow={t('places.eyebrow')} title={t('places.title')} actions={<Button onClick={() => setEditing('new')}>{t('places.add')}</Button>} />

      <label className="mb-3 flex items-center gap-2 rounded-(--radius-control) border border-line bg-paper px-3 py-2.5 shadow-soft">
        <Icon name="search" className="text-muted" />
        <input aria-label={t('places.filterPlaceholder')} placeholder={t('places.filterPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label={t('places.form.cat')}>
        {(['all', ...PLACE_CATEGORY_KEYS] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={cat === c}
            onClick={() => setCat(c)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${cat === c ? 'border-sage bg-sage text-white' : 'border-line bg-paper text-[#55645d] hover:bg-sage-light'}`}
          >
            {c === 'all' ? (
              t('places.all')
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Icon name={PLACE_CATEGORIES[c].icon} />
                {t(`placeCat.${c}`)}
              </span>
            )}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-(--radius-card) bg-paper p-10 text-center text-muted shadow-card">{t('places.empty')}</div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] items-start gap-4">
          {shown.map((p) => {
            const c = PLACE_CATEGORIES[p.cat as PlaceCategory] ?? PLACE_CATEGORIES.other
            return (
              <li key={p.id} className="flex flex-col rounded-(--radius-card) p-5 shadow-card" style={{ background: p.bgColor && p.bgColor !== '#ffffff' ? p.bgColor : '#fff' }}>
                <div className="flex items-start gap-3.5">
                  <div className="grid size-[calc(48px*var(--fs))] shrink-0 place-items-center rounded-(--radius-card) text-[#4f6b60] shadow-soft" style={{ background: c.bg }} aria-hidden>
                    <Icon name={c.icon} className="size-[62%]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-[length:calc(15px*var(--fs))]">{p.name}</strong>
                    <small className="text-[length:calc(11px*var(--fs))] font-semibold text-muted">{t(`placeCat.${p.cat}`)}</small>
                  </div>
                </div>
                {p.address && (
                  <p className="mt-3 flex gap-1.5 text-xs text-[#55645d]">
                    <Icon name="pin" className="mt-px text-[#8aa096]" />
                    {p.address}
                  </p>
                )}
                {p.hours && <p className="mt-2 max-h-24 overflow-y-auto rounded-lg border border-line bg-[#f9fbf9] px-2.5 py-2 text-[length:calc(11px*var(--fs))] leading-relaxed whitespace-pre-wrap text-[#55645d]">{p.hours}</p>}
                {p.note && <p className="mt-2.5 border-t border-dashed border-line pt-2.5 text-xs leading-relaxed whitespace-pre-wrap text-[#66766e]">{p.note}</p>}
                <div className="mt-4 flex gap-2">
                  <a href={mapsUrl(p)} target="_blank" rel="noreferrer" className="flex-1 rounded-(--radius-control) bg-sage px-3 py-2.5 text-center text-xs font-bold text-white hover:bg-sage-dark">
                    {t('places.openMaps')}
                  </a>
                  <Button variant="ghost" onClick={() => setEditing(p)}>
                    {t('places.edit')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editing && <PlaceDialog key={editing === 'new' ? 'new' : editing.id} place={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
