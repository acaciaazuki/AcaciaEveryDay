import { Command } from 'cmdk'
import * as RD from '@radix-ui/react-dialog'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { PLACE_CATEGORIES, type PlaceCategory } from '../core/categories'
import { formatMoney } from '../core/format'
import { SEARCH_SCOPES, excerpt, searchAll, splitHighlight, tokenize, type SearchHit, type SearchKind, type SearchScope } from '../core/search'
import { useAppStore } from '../store/useAppStore'

const RECENT_KEY = 'acacia_recent_search'
const RECENT_MAX = 8

function loadRecent(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}
function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    /* 無痕模式等情況存不了，不影響搜尋 */
  }
}

/** 把命中的關鍵字標出來 */
function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  return (
    <>
      {splitHighlight(text, tokens).map(([s, hit], i) =>
        hit ? (
          <mark key={i} className="rounded-sm bg-[#fde68a] px-0.5 text-inherit">
            {s}
          </mark>
        ) : (
          <span key={i}>{s}</span>
        ),
      )}
    </>
  )
}

/** ⌘K / Ctrl+K 全域搜尋：行程、待辦、記帳（含已歸檔）、地點 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-[#26363355] backdrop-blur-[2px]" />
        <RD.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 w-[min(600px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-(--radius-card) bg-paper shadow-card"
        >
          <RD.Title className="sr-only">{t('search.title')}</RD.Title>
          {/* 內容只在開啟時才存在，所以每次開啟都是乾淨的搜尋框 */}
          <PaletteBody onOpenChange={onOpenChange} />
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  )
}

function PaletteBody({ onOpenChange }: { onOpenChange: (o: boolean) => void }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { events, tasks, shopping, archives, places } = useAppStore()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SearchScope>('all')
  const [recent, setRecent] = useState<string[]>(loadRecent)
  const lng = i18n.resolvedLanguage ?? 'zh-TW'

  const tokens = useMemo(() => tokenize(query), [query])
  const hits = useMemo(
    () =>
      searchAll({ events, tasks, shopping, archives, places }, query, scope, {
        money: (n) => formatMoney(n, lng),
        expenseCat: (e) => (e.cat === 'other' && e.customCat ? e.customCat : t(`expenseCat.${e.cat}`)),
        placeCat: (c) => t(`placeCat.${c}`),
      }),
    // eslint 無法追 t 的穩定性；語系變了就重算
    [events, tasks, shopping, archives, places, query, scope, lng, t],
  )

  const counts = useMemo(() => {
    const all = searchAll({ events, tasks, shopping, archives, places }, query, 'all', {
      money: (n) => formatMoney(n, lng),
      expenseCat: (e) => (e.cat === 'other' && e.customCat ? e.customCat : t(`expenseCat.${e.cat}`)),
      placeCat: (c) => t(`placeCat.${c}`),
    })
    const c: Record<SearchScope, number> = {
      all: all.length,
      events: 0,
      tasks: 0,
      shopping: 0,
      places: 0,
    }
    for (const h of all) c[h.kind]++
    return c
  }, [events, tasks, shopping, archives, places, query, lng, t])

  const remember = () => {
    const q = query.trim()
    if (!q) return
    const next = [q, ...recent.filter((r) => r !== q)].slice(0, RECENT_MAX)
    setRecent(next)
    saveRecent(next)
  }
  const go = (hit: SearchHit) => {
    remember()
    onOpenChange(false)
    void navigate(hit.path)
  }
  const clearRecent = () => {
    setRecent([])
    saveRecent([])
  }

  const badgeLabel = (k: SearchKind) => t(`search.badge.${k}`)
  const badge = 'shrink-0 rounded-md bg-mint px-2 py-0.5 text-[length:calc(10px*var(--fs))] font-bold text-sage-dark'
  const item = 'flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-[length:calc(13px*var(--fs))] data-[selected=true]:bg-sage-light'

  return (
    <Command label={t('search.title')} shouldFilter={false} loop>
      <div className="flex items-center gap-1 border-b border-line px-4">
        <span aria-hidden className="text-sage">
          ⌕
        </span>
        <Command.Input autoFocus value={query} onValueChange={setQuery} placeholder={t('search.placeholder')} className="h-12 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none" />
        {query && (
          <button type="button" aria-label={t('search.clear')} onClick={() => setQuery('')} className="grid size-7 place-items-center rounded-full text-muted hover:bg-oat">
            ✕
          </button>
        )}
        <RD.Close className="rounded-md border border-line px-2 py-1 text-[length:calc(11px*var(--fs))] font-semibold text-muted hover:bg-oat">{t('search.close')}</RD.Close>
      </div>

      <div role="tablist" aria-label={t('search.scope')} className="flex gap-1.5 overflow-x-auto border-b border-line px-3 py-2">
        {SEARCH_SCOPES.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={scope === s}
            onClick={() => setScope(s)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${scope === s ? 'bg-sage text-white' : 'bg-oat text-muted hover:text-ink'}`}
          >
            {t(`search.scopes.${s}`)}
            {tokens.length > 0 && <span className="ml-1 opacity-70">{counts[s]}</span>}
          </button>
        ))}
      </div>

      <Command.List className="max-h-[56vh] overflow-y-auto p-2">
        {tokens.length === 0 ? (
          <div className="px-3 py-4">
            <p className="text-[length:calc(13px*var(--fs))] text-muted">{t('search.hint')}</p>
            {recent.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[length:calc(10px*var(--fs))] font-bold tracking-widest text-muted">{t('search.recent')}</h3>
                  <button type="button" onClick={clearRecent} className="text-[length:calc(11px*var(--fs))] text-muted hover:text-ink">
                    {t('search.clearRecent')}
                  </button>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <li key={r}>
                      <button type="button" onClick={() => setQuery(r)} className="rounded-full border border-line px-3 py-1 text-xs hover:bg-sage-light">
                        {r}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : hits.length === 0 ? (
          <Command.Empty className="py-8 text-center text-[length:calc(13px*var(--fs))] text-muted">{t('search.empty')}</Command.Empty>
        ) : (
          hits.map((h) => (
            <Command.Item key={h.key} value={h.key} onSelect={() => go(h)} className={item}>
              <span className={badge}>
                {h.kind === 'places' ? `${PLACE_CATEGORIES[(places.find((p) => p.id === h.id)?.cat ?? 'other') as PlaceCategory]?.icon ?? '📍'} ` : ''}
                {badgeLabel(h.kind)}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate ${h.done ? 'line-through opacity-60' : ''}`}>
                  <Highlight text={h.title} tokens={tokens} />
                </span>
                {h.meta && (
                  <small className="block truncate text-[length:calc(11px*var(--fs))] text-muted">
                    <Highlight text={h.meta} tokens={tokens} />
                  </small>
                )}
                {h.snippet && (
                  <small className="mt-0.5 block truncate text-[length:calc(11px*var(--fs))] text-[#55645d]">
                    <b className="mr-1 font-semibold">{t(`search.field.${h.snippet.field}`)}</b>
                    <Highlight text={excerpt(h.snippet.text, tokens)} tokens={tokens} />
                  </small>
                )}
              </span>
              {h.archived && <span className="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[length:calc(10px*var(--fs))] text-muted">{t('search.archived')}</span>}
            </Command.Item>
          ))
        )}
      </Command.List>
    </Command>
  )
}
