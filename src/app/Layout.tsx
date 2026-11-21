import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'
import { CommandPalette } from '../components/CommandPalette'
import { SyncPanel } from '../components/SyncPanel'
import { useAppStore } from '../store/useAppStore'

const MAIN = [
  { to: '/', ico: '◷', key: 'today', end: true },
  { to: '/calendar', ico: '▦', key: 'calendar' },
  { to: '/places', ico: '📍', key: 'places' },
  { to: '/tasks', ico: '☑', key: 'tasks' },
] as const

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex w-full items-center gap-3 rounded-(--radius-control) px-3 py-2.5 text-[13px] font-semibold transition-colors ${
    isActive ? 'bg-sage-light text-sage-dark' : 'text-[#7e8b85] hover:bg-[#f6f9f7] hover:text-[#5a6d63]'
  }`

export function Layout() {
  const { t } = useTranslation()
  const openTasks = useAppStore((s) => s.tasks.filter((x) => !x.done).length)
  const [searchOpen, setSearchOpen] = useState(false)
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col border-r border-line bg-paper px-4 py-6 min-[681px]:flex">
        <div className="flex items-center gap-3 px-2.5 pb-7 text-lg font-extrabold tracking-tight">
          <span className="grid size-9 place-items-center rounded-xl bg-mint text-lg text-sage">✿</span>
          {t('app.name')}
        </div>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="mb-4 flex items-center gap-2 rounded-(--radius-control) border border-line bg-oat px-3 py-2 text-left text-xs text-muted hover:border-sage"
        >
          <span aria-hidden>⌕</span>
          <span className="flex-1">{t('search.button')}</span>
          <kbd className="rounded border border-line bg-paper px-1.5 text-[10px]">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <nav className="grid gap-1">
          {MAIN.map((n) => (
            <NavLink key={n.to} to={n.to} end={'end' in n} className={linkClass}>
              <span className="w-5 text-center text-base">{n.ico}</span>
              {t(`nav.${n.key}`)}
              {n.key === 'tasks' && (
                <span className="ml-auto rounded-full bg-[#f1f4f2] px-2 py-0.5 text-[10px] font-bold text-[#8c9993]">{openTasks}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 pt-4 pb-2 text-[10px] font-bold tracking-[1.5px] text-[#a4afaa] uppercase">{t('nav.sectionCollect')}</div>
        <nav className="grid gap-1">
          <NavLink to="/shopping" className={linkClass}>
            <span className="w-5 text-center text-base">🛒</span>
            {t('nav.shopping')}
          </NavLink>
        </nav>
        <div className="mt-auto grid gap-3">
          <div className="rounded-(--radius-card) border border-line p-3">
            <SyncPanel />
          </div>
        <nav className="grid gap-1">
          <NavLink to="/settings" className={linkClass}>
            <span className="w-5 text-center text-base">⚙</span>
            {t('nav.settings')}
          </NavLink>
        </nav>
        </div>
      </aside>

      <main className="mx-auto max-w-[1400px] px-3.5 pt-4 pb-[calc(88px+env(safe-area-inset-bottom))] min-[681px]:ml-60 min-[681px]:px-6 min-[681px]:pb-16 min-[1001px]:px-9">
        <button
          type="button"
          aria-label={t('search.button')}
          onClick={() => setSearchOpen(true)}
          className="float-right mt-1 grid size-9 place-items-center rounded-full border border-line bg-paper text-sage shadow-soft min-[681px]:hidden"
        >
          ⌕
        </button>
        <Outlet />
      </main>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-paper px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_#29483a08] min-[681px]:hidden">
        {[
          { to: '/', ico: '◷', label: t('nav.today'), end: true },
          { to: '/calendar', ico: '▦', label: t('nav.calendar') },
          { to: '/places', ico: '📍', label: t('nav.mobile.places') },
          { to: '/tasks', ico: '☑', label: t('nav.mobile.tasks') },
          { to: '/shopping', ico: '🛒', label: t('nav.mobile.shopping') },
          { to: '/settings', ico: '⚙', label: t('nav.settings') },
        ].map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `grid justify-items-center gap-0.5 px-1 text-[10px] font-semibold ${isActive ? 'text-sage-dark' : 'text-[#9aa6a0]'}`}
          >
            <span className="text-lg leading-none">{n.ico}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
