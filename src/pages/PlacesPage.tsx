import { Icon } from '../components/AcaciaIcons'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getLocationAdapter, type LocationError } from '../adapters/geofence'
import { Button } from '../components/Button'
import { PageHead } from '../components/PageHead'
import { PlaceDialog } from '../components/PlaceDialog'
import { SortableList } from '../components/SortableList'
import { PLACE_CATEGORIES, PLACE_CATEGORY_KEYS, type PlaceCategory } from '../core/categories'
import { formatDistance, PLACE_SORTS, sortByCategory, sortByDistance, sortByOpen, type OpenStatus, type PlaceSort } from '../core/placeSort'
import { mapsUrl } from '../core/places'
import type { LatLng } from '../core/reminders'
import type { Place } from '../core/schema'
import { formatTime } from '../core/time'
import { useNow } from '../hooks/useNow'
import { useOpenFromUrl } from '../hooks/useOpenFromUrl'
import { useAppStore } from '../store/useAppStore'
import { useConsentStore } from '../store/useConsentStore'

/** 依距離排序用的目前位置：只放在記憶體，不儲存、不上傳 */
type Loc = { kind: 'idle' } | { kind: 'locating' } | { kind: 'ok'; here: LatLng } | { kind: 'error'; reason: LocationError | 'unsupported' | 'consent' }

const OPEN_BADGE: Record<OpenStatus['state'], string> = {
  open: 'bg-sage text-white',
  later: 'bg-[#fff3dc] text-[#9a6a17]',
  ended: 'bg-[#eef1ef] text-[#66766e]',
  closed: 'bg-[#fdecea] text-[#b4533c]',
  unknown: 'bg-[#f3f4f3] text-[#8a958f]',
}

const pill = (on: boolean) =>
  `shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? 'border-sage bg-sage text-white' : 'border-line bg-paper text-[#55645d] hover:bg-sage-light'}`

export function PlacesPage() {
  const { t, i18n } = useTranslation()
  const places = useAppStore((s) => s.places)
  const sort: PlaceSort = useAppStore((s) => s.settings.placeSort) ?? 'custom'
  const setPlaceSort = useAppStore((s) => s.setPlaceSort)
  const reorderPlaces = useAppStore((s) => s.reorderPlaces)
  const consented = useConsentStore((s) => s.status === 'accepted')
  const [cat, setCat] = useState<PlaceCategory | 'all'>('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Place | 'new' | null>(null)
  const [reordering, setReordering] = useState(false)
  const [loc, setLoc] = useState<Loc>({ kind: 'idle' })
  const now = useNow()
  useOpenFromUrl(places, setEditing)

  const locate = async () => {
    // 同意隱私權政策之前不啟動定位（同意畫面擋住整個 App，這裡再保險檢查一次）
    if (!consented) return setLoc({ kind: 'error', reason: 'consent' })
    const adapter = getLocationAdapter()
    if (!adapter.supported) return setLoc({ kind: 'error', reason: 'unsupported' })
    setLoc({ kind: 'locating' })
    try {
      const fix = await adapter.getCurrent()
      setLoc({ kind: 'ok', here: { lat: fix.lat, lng: fix.lng } })
    } catch (e) {
      setLoc({ kind: 'error', reason: e === 'denied' || e === 'timeout' ? e : 'unavailable' })
    }
  }

  // 上次選了「距離」：只有在已經允許過定位時才自動取得位置，否則等使用者按按鈕，不主動跳出權限詢問
  const wantsDistance = sort === 'distance'
  useEffect(() => {
    if (!wantsDistance || !consented) return
    let cancelled = false
    const adapter = getLocationAdapter()
    if (!adapter.supported || !adapter.permission) return
    void adapter.permission().then((state) => {
      if (cancelled || state !== 'granted') return
      setLoc({ kind: 'locating' })
      adapter.getCurrent().then(
        (fix) => !cancelled && setLoc({ kind: 'ok', here: { lat: fix.lat, lng: fix.lng } }),
        (e) => !cancelled && setLoc({ kind: 'error', reason: e === 'denied' || e === 'timeout' ? e : 'unavailable' }),
      )
    })
    return () => {
      cancelled = true
    }
  }, [wantsDistance, consented])

  const chooseSort = (next: PlaceSort) => {
    setPlaceSort(next)
    if (next === 'distance' && loc.kind !== 'ok' && loc.kind !== 'locating') void locate()
  }

  const startReorder = () => {
    setReordering(true)
    if (sort !== 'custom') setPlaceSort('custom')
  }

  const needle = q.trim().toLowerCase()
  const filtered = places.filter(
    (p) => (cat === 'all' || p.cat === cat) && (!needle || [p.name, p.address, p.note].some((s) => s.toLowerCase().includes(needle))),
  )

  let shown = filtered
  let distances: Map<string, number | null> | null = null
  let statuses: Map<string, OpenStatus> | null = null
  if (sort === 'category') shown = sortByCategory(filtered)
  else if (sort === 'distance' && loc.kind === 'ok') ({ sorted: shown, distances } = sortByDistance(filtered, loc.here))
  else if (sort === 'open') ({ sorted: shown, statuses } = sortByOpen(filtered, now))
  const noCoords = distances ? [...distances.values()].filter((d) => d === null).length : 0

  const distanceText = (id: string) => {
    const d = distances?.get(id)
    if (d === undefined) return null
    if (d === null) return t('places.sort.distanceUnknown')
    const f = formatDistance(d)
    return t(`places.sort.${f.unit}`, { value: f.value })
  }
  const openText = (s: OpenStatus) => (s.state === 'later' && s.opensAt ? t('places.sort.status.laterAt', { time: formatTime(s.opensAt, i18n.resolvedLanguage) }) : t(`places.sort.status.${s.state}`))

  const notice = (() => {
    if (sort === 'open') return { text: t('places.sort.openHint') }
    if (sort !== 'distance') return null
    switch (loc.kind) {
      case 'idle':
        return { text: t('places.sort.needLocation'), action: t('places.sort.useLocation') }
      case 'locating':
        return { text: t('places.sort.locating') }
      case 'error':
        return { text: t(`places.sort.error.${loc.reason}`), action: loc.reason === 'consent' || loc.reason === 'unsupported' ? undefined : t('places.sort.retry'), warn: true }
      case 'ok':
        return { text: [t('places.sort.located'), noCoords ? t('places.sort.noCoords', { count: noCoords }) : ''].filter(Boolean).join(' '), action: t('places.sort.relocate') }
    }
  })()

  return (
    <>
      <PageHead eyebrow={t('places.eyebrow')} title={t('places.title')} actions={<Button onClick={() => setEditing('new')}>{t('places.add')}</Button>} />

      {reordering ? (
        <section aria-labelledby="place-reorder-title" className="rounded-(--radius-card) bg-paper p-4 shadow-card sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <h2 id="place-reorder-title" className="text-sm font-bold">
                {t('places.sort.reorderTitle')}
              </h2>
              <p className="mt-0.5 text-xs text-muted">{t('places.sort.reorderHint')}</p>
            </div>
            <Button onClick={() => setReordering(false)}>{t('places.sort.done')}</Button>
          </div>
          <SortableList
            label={t('places.sort.reorderTitle')}
            items={places.map((p) => ({ id: p.id, label: p.name, icon: (PLACE_CATEGORIES[p.cat as PlaceCategory] ?? PLACE_CATEGORIES.other).icon }))}
            onChange={reorderPlaces}
          />
        </section>
      ) : (
        <>
      <label className="mb-3 flex items-center gap-2 rounded-(--radius-control) border border-line bg-paper px-3 py-2.5 shadow-soft">
        <Icon name="search" className="text-muted" />
        <input aria-label={t('places.filterPlaceholder')} placeholder={t('places.filterPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label={t('places.form.cat')}>
        {(['all', ...PLACE_CATEGORY_KEYS] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={cat === c}
            onClick={() => setCat(c)}
            className={pill(cat === c)}
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

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span id="place-sort-label" className="text-xs font-semibold text-muted">
          {t('places.sort.label')}
        </span>
        <div role="radiogroup" aria-labelledby="place-sort-label" className="flex flex-wrap gap-2">
          {PLACE_SORTS.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={sort === s} onClick={() => chooseSort(s)} className={pill(sort === s)}>
              {t(`places.sort.${s}`)}
            </button>
          ))}
        </div>
        <Button variant="ghost" className="ml-auto" disabled={places.length < 2} onClick={startReorder}>
          {t('places.sort.reorder')}
        </Button>
      </div>

      <div aria-live="polite" className="mb-4 empty:hidden">
        {notice && (
          <p className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-(--radius-control) border px-3 py-2 text-xs leading-relaxed ${notice.warn ? 'border-[#f0d4c8] bg-[#fff6f2] text-[#a24f37]' : 'border-line bg-sage-light/50 text-[#55645d]'}`}>
            <span className="min-w-0 flex-1">{notice.text}</span>
            {notice.action && (
              <button type="button" onClick={() => void locate()} className="shrink-0 font-bold text-sage-dark underline underline-offset-2">
                {notice.action}
              </button>
            )}
          </p>
        )}
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
                    <Icon name={c.icon} className="size-[68%]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-[length:calc(15px*var(--fs))]">{p.name}</strong>
                    <small className="text-[length:calc(11px*var(--fs))] font-semibold text-muted">{t(`placeCat.${p.cat}`)}</small>
                    {(distances || statuses) && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {distances && <span className="rounded-full bg-sage-light px-2 py-0.5 text-[length:calc(11px*var(--fs))] font-bold text-sage-dark">{distanceText(p.id)}</span>}
                        {statuses?.get(p.id) && (
                          <span className={`rounded-full px-2 py-0.5 text-[length:calc(11px*var(--fs))] font-bold ${OPEN_BADGE[statuses.get(p.id)!.state]}`}>{openText(statuses.get(p.id)!)}</span>
                        )}
                      </div>
                    )}
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
        </>
      )}

      {editing && <PlaceDialog key={editing === 'new' ? 'new' : editing.id} place={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
