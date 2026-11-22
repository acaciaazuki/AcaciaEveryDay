import { lazy, Suspense, useState } from 'react'
import { useFontScale } from '../hooks/useFontScale'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Icon } from '../components/AcaciaIcons'
import type { IconName } from '../core/icons'
import { BootSplash, BrandLogo } from '../components/BrandMark'
import { CommandPalette } from '../components/CommandPalette'
import { ReminderBanner } from '../components/ReminderBanner'
import { LicensesLink } from '../components/LicensesLink'
import { PrivacyLink } from '../components/PrivacyLink'
import { SyncPanel } from '../components/SyncPanel'
import { useReminderMonitor } from '../hooks/useReminderMonitor'
import { useNow } from '../hooks/useNow'
import { toLocalISO } from '../core/date'
import { isDue, isLow } from '../core/inventory'
import { useNavOrder } from '../hooks/useNavOrder'
import { useAppStore } from '../store/useAppStore'
import { useConsentStore } from '../store/useConsentStore'

// 同意面板含政策全文與授權清單，只有需要詢問時才下載
const ConsentGate = lazy(() => import('../components/ConsentGate'))

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

/**
 * 第一次使用或政策改版時，先顯示同意面板；同意之前不顯示 App，
 * 也不啟動定位等功能（/privacy 網址一樣顯示同意面板，政策全文照樣可以閱讀）。
 */
export function Layout() {
  const status = useConsentStore((s) => s.status)
  const { t } = useTranslation()
  if (status === 'accepted') return <AppShell />
  // 讀取同意紀錄、或同意面板還在下載時，顯示相思樹載入畫面（和 index.html 的 #boot-splash 同一張圖）
  const splash = <BootSplash label={t('app.loading')} />
  if (status === 'loading') return splash
  return (
    <div className="min-h-dvh bg-oat">
      <Suspense fallback={splash}>
        <ConsentGate />
      </Suspense>
    </div>
  )
}

function AppShell() {
  const { t } = useTranslation()
  const openTasks = useAppStore((s) => s.tasks.filter((x) => !x.done).length)
  const todayISO = toLocalISO(useNow())
  // 側邊欄提示：要汰換／即期或待補貨的用品數
  const invAlerts = useAppStore((s) => s.inventory.filter((x) => isLow(x) || isDue(x, todayISO)).length)
  const collect = useNavOrder('collect')
  const [searchOpen, setSearchOpen] = useState(false)
  useFontScale()
  useReminderMonitor()
  // 行事曆需要更寬的版面，月曆才放得下較多行程
  const wide = useLocation().pathname.startsWith('/calendar')
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col border-r border-line bg-paper px-4 py-6 min-[681px]:flex">
        <BrandLogo name={t('app.name')} className="px-2.5 pb-7" />
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
              <Icon name={n.ico} className="size-[1.9em]" />
              {t(`nav.${n.key}`)}
              {n.key === 'tasks' && (
                <span className="ml-auto rounded-full bg-[#f1f4f2] px-2 py-0.5 text-[length:calc(10px*var(--fs))] font-bold text-[#8c9993]">{openTasks}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="group/collect flex items-center px-3 pt-4 pb-2">
          <span className="flex-1 text-[length:calc(10px*var(--fs))] font-bold tracking-[1.5px] text-[#a4afaa] uppercase">{t('nav.sectionCollect')}</span>
          {/* 低調的排序入口：滑過或用 Tab 移到時才明顯 */}
          <Link
            to="/settings#nav-order"
            title={t('settings.navOrder.edit')}
            aria-label={t('settings.navOrder.edit')}
            className="rounded-full px-1.5 text-[length:calc(10px*var(--fs))] font-semibold text-[#c2cbc6] transition-colors group-hover/collect:text-[#8c9993] hover:bg-sage-light hover:text-sage-dark focus-visible:text-sage-dark"
          >
            {t('settings.navOrder.editShort')}
          </Link>
        </div>
        <nav className="grid gap-1">
          {collect.map((n) => (
            <NavLink key={n.key} to={n.to} className={linkClass}>
              <Icon name={n.ico} className="size-[1.9em]" />
              {t(`nav.${n.key}`)}
              {n.key === 'inventory' && invAlerts > 0 && (
                <span className="ml-auto rounded-full bg-[#ffe6d1] px-2 py-0.5 text-[length:calc(10px*var(--fs))] font-bold text-[#b4532a]" title={t('inv.navBadge', { count: invAlerts })}>
                  {invAlerts}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto grid gap-3">
          <div className="rounded-(--radius-card) border border-line p-3">
            <SyncPanel />
          </div>
        <nav className="grid gap-1">
          <NavLink to="/settings" className={linkClass}>
            <Icon name="settings" className="size-[1.9em]" />
            {t('nav.settings')}
          </NavLink>
        </nav>
        <div className="-mt-2 flex flex-wrap gap-x-3 px-3">
          <PrivacyLink />
          <LicensesLink />
        </div>
        </div>
      </aside>

      <main className={`mx-auto ${wide ? 'max-w-[2000px]' : 'max-w-[1400px]'} px-3.5 pt-4 pb-[calc(88px+env(safe-area-inset-bottom))] min-[681px]:ml-60 min-[681px]:px-6 min-[681px]:pb-16 min-[1001px]:px-9`}>
        <button
          type="button"
          aria-label={t('search.button')}
          onClick={() => setSearchOpen(true)}
          className="float-right mt-1 grid size-9 place-items-center rounded-full border border-line bg-paper text-sage shadow-soft min-[681px]:hidden"
        >
          <Icon name="search" className="size-[1.7em]" />
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
            <Icon name={n.ico} className="size-[2.4em]" />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
