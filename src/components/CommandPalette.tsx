import { Command } from 'cmdk'
import * as RD from '@radix-ui/react-dialog'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { PLACE_CATEGORIES, type PlaceCategory } from '../core/categories'
import { useAppStore } from '../store/useAppStore'

/** ⌘K / Ctrl+K 全域搜尋：行程、待辦、記帳、地點 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { events, tasks, shopping, places } = useAppStore()

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

  const go = (path: string) => {
    onOpenChange(false)
    void navigate(path)
  }

  const item = 'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-[length:calc(13px*var(--fs))] data-[selected=true]:bg-sage-light'
  const badge = 'shrink-0 rounded-md bg-mint px-2 py-0.5 text-[length:calc(10px*var(--fs))] font-bold text-sage-dark'
  const sub = 'ml-auto shrink-0 text-[length:calc(11px*var(--fs))] text-muted'
  const group = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[length:calc(10px*var(--fs))] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted'

  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-[#26363355] backdrop-blur-[2px]" />
        <RD.Content aria-describedby={undefined} className="fixed top-[12vh] left-1/2 z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-(--radius-card) bg-paper shadow-card">
          <RD.Title className="sr-only">{t('search.title')}</RD.Title>
          <Command label={t('search.title')} loop>
            <div className="flex items-center gap-2 border-b border-line px-4">
              <span aria-hidden className="text-sage">
                ⌕
              </span>
              <Command.Input autoFocus placeholder={t('search.placeholder')} className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none" />
              <kbd className="rounded border border-line px-1.5 text-[length:calc(10px*var(--fs))] text-muted">Esc</kbd>
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="py-8 text-center text-[length:calc(13px*var(--fs))] text-muted">{t('search.empty')}</Command.Empty>
              {events.length > 0 && (
                <Command.Group heading={t('search.events')} className={group}>
                  {events.map((e) => (
                    <Command.Item key={e.id} value={`event-${e.id}`} keywords={[e.title, e.note, e.dateISO]} onSelect={() => go(`/calendar?open=${e.id}`)} className={item}>
                      <span className={badge}>{t('search.event')}</span>
                      <span className="truncate">{e.title}</span>
                      <span className={sub}>
                        {e.dateISO} {e.start}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {tasks.length > 0 && (
                <Command.Group heading={t('search.tasks')} className={group}>
                  {tasks.map((x) => (
                    <Command.Item key={x.id} value={`task-${x.id}`} keywords={[x.title, x.loc]} onSelect={() => go(`/tasks?open=${x.id}`)} className={item}>
                      <span className={badge}>{t('search.task')}</span>
                      <span className={`truncate ${x.done ? 'line-through opacity-60' : ''}`}>{x.title}</span>
                      <span className={sub}>{x.done ? t('tasks.completed') : t('tasks.pending')}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {shopping.length > 0 && (
                <Command.Group heading={t('search.shopping')} className={group}>
                  {shopping.map((s) => (
                    <Command.Item key={s.id} value={`shop-${s.id}`} keywords={[s.title, s.store, s.customCat ?? '', t(`expenseCat.${s.cat}`)]} onSelect={() => go(`/shopping?open=${s.id}`)} className={item}>
                      <span className={badge}>{t('search.expense')}</span>
                      <span className="truncate">{s.title}</span>
                      <span className={sub}>{s.store || s.date}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {places.length > 0 && (
                <Command.Group heading={t('search.places')} className={group}>
                  {places.map((p) => (
                    <Command.Item key={p.id} value={`place-${p.id}`} keywords={[p.name, p.address, p.note, t(`placeCat.${p.cat}`)]} onSelect={() => go(`/places?open=${p.id}`)} className={item}>
                      <span className={badge}>{PLACE_CATEGORIES[p.cat as PlaceCategory]?.icon ?? '📍'}</span>
                      <span className="truncate">{p.name}</span>
                      <span className={sub}>{t(`placeCat.${p.cat}`)}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  )
}
