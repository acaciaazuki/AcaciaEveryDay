import { useState } from 'react'
import { useFontScale } from '../hooks/useFontScale'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Icon } from '../components/AcaciaIcons'
import type { IconName } from '../core/icons'
import { BrandMark } from '../components/BrandMark'
import { CommandPalette } from '../components/CommandPalette'
import { ReminderBanner } from '../components/ReminderBanner'
import { SyncPanel } from '../components/SyncPanel'
import { useReminderMonitor } from '../hooks/useReminderMonitor'
import { useAppStore } from '../store/useAppStore'

const MAIN = [
  { to: '/', ico: 'today', key: 'today', end: true },
  { to: '/calendar', ico: 'calendar', key: 'calendar' },
  { to: '/places', ico: 'pin', key: 'places' },
  { to: '/tasks', ico: 'tasks', key: 'tasks' },
] as const satisfies readonly { to: string; ico: IconName; key: string; end?: boolean }[]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex w-full items-center gap-3 rounded-(--radius-control) px-3 py-2.5 text-[length:calc(13px*var(--fs))] font-semibold transition-colors ${
    isActive ? 'bg-sage-light text-sage-dark' : 'text-[#7e8b85] hover:bg-[#f6f9f7] hover:text-[#5a6d63]'
  }`

export function Layout() {
  const { t } = useTranslation()
  const openTasks = useAppStore((s) => s.tasks.filter((x) => !x.done).length)
  const [searchOpen, setSearchOpen] = useState(false)
  useFontScale()
  useReminderMonitor()
  // 行事曆需要更寬的版面，月曆才放得下較多行程
  const wide = useLocation().pathname.startsWith('/calendar')
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col border-r border-line bg-paper px-4 py-6 min-[681px]:flex">
        <div className="flex items-center gap-3 px-2.5 pb-7 text-lg font-extrabold tracking-tight">
          <BrandMark />
          {t('app.name')}
        </div>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="mb-4 flex items-center gap-2 rounded-(--radius-control) border border-line bg-oat px-3 py-2 text-left text-xs text-muted hover:border-sage"
        >
          <Icon name="search" className="text-sage" />
          <span className="flex-1">{t('search.button')}</span>
          <kbd className="rounded border border-line bg-paper px-1.5 text-[length:calc(10px*var(--fs))]">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <nav className="grid gap-1">
          {MAIN.map((n) => (
            <NavLink key={n.to} to={n.to} end={'end' in n} className={linkClass}>
              <Icon name={n.ico} className="size-[1.4em]" />
              {t(`nav.${n.key}`)}
              {n.key === 'tasks' && (
                <span className="ml-auto rounded-full bg-[#f1f4f2] px-2 py-0.5 text-[length:calc(10px*var(--fs))] font-bold text-[#8c9993]">{openTasks}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 pt-4 pb-2 text-[length:calc(10px*var(--fs))] font-bold tracking-[1.5px] text-[#a4afaa] uppercase">{t('nav.sectionCollect')}</div>
        <nav className="grid gap-1">
          <NavLink to="/shopping" className={linkClass}>
            <Icon name="shopping" className="size-[1.4em]" />
            {t('nav.shopping')}
          </NavLink>
          <NavLink to="/reminders" className={linkClass}>
            <Icon name="reminders" className="size-[1.4em]" />
            {t('nav.reminders')}
          </NavLink>
        </nav>
        <div className="mt-auto grid gap-3">
          <div className="rounded-(--radius-card) border border-line p-3">
            <SyncPanel />
          </div>
        <nav className="grid gap-1">
          <NavLink to="/settings" className={linkClass}>
            <Icon name="settings" className="size-[1.4em]" />
            {t('nav.settings')}
          </NavLink>
        </nav>
        </div>
      </aside>

      <main className={`mx-auto ${wide ? 'max-w-[2000px]' : 'max-w-[1400px]'} px-3.5 pt-4 pb-[calc(88px+env(safe-area-inset-bottom))] min-[681px]:ml-60 min-[681px]:px-6 min-[681px]:pb-16 min-[1001px]:px-9`}>
        <button
          type="button"
          aria-label={t('search.button')}
          onClick={() => setSearchOpen(true)}
          className="float-right mt-1 grid size-9 place-items-center rounded-full border border-line bg-paper text-sage shadow-soft min-[681px]:hidden"
        >
          <Icon name="search" className="size-[1.3em]" />
        </button>
        <Outlet />
      </main>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <ReminderBanner />

      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-paper px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_#29483a08] min-[681px]:hidden">
        {[
          { to: '/', ico: 'today' as IconName, label: t('nav.today'), end: true },
          { to: '/calendar', ico: 'calendar' as IconName, label: t('nav.calendar') },
          { to: '/places', ico: 'pin' as IconName, label: t('nav.mobile.places') },
          { to: '/tasks', ico: 'tasks' as IconName, label: t('nav.mobile.tasks') },
          { to: '/shopping', ico: 'shopping' as IconName, label: t('nav.mobile.shopping') },
          { to: '/settings', ico: 'settings' as IconName, label: t('nav.settings') },
        ].map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `grid justify-items-center gap-0.5 px-1 text-[length:calc(10px*var(--fs))] font-semibold ${isActive ? 'text-sage-dark' : 'text-[#9aa6a0]'}`}
          >
            <Icon name={n.ico} className="size-[1.9em]" />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
