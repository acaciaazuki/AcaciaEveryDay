import { useEffect, useRef, useState } from 'react'
import { backupFileName, downloadJson, downloadText, spacesFileName } from '../adapters/downloadJson'
import { buildIcs, icsFileName } from '../core/ics'
import { useCalendarExport } from '../hooks/useVisibleCalendar'
import { Icon } from '../components/AcaciaIcons'
import { Link, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BackupPanel } from '../components/BackupPanel'
import { Button } from '../components/Button'
import { DeleteDataPanel } from '../components/DeleteDataPanel'
import { NavOrderPanel } from '../components/NavOrderPanel'
import { LicensesLink } from '../components/LicensesLink'
import { PageHead } from '../components/PageHead'
import { PrivacyLink } from '../components/PrivacyLink'
import { SpacesPanel } from '../components/SpacesPanel'
import { SyncPanel } from '../components/SyncPanel'
import { LANGUAGES } from '../i18n'
import { currencyName, currencySymbol } from '../core/format'
import { CURRENCIES, FONT_SCALE, FONT_SIZES } from '../core/schema'
import { useCurrency } from '../hooks/useCurrency'
import { useAppStore } from '../store/useAppStore'

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const importData = useAppStore((s) => s.importData)
  const exportData = useAppStore((s) => s.exportData)
  const fontSize = useAppStore((s) => s.settings.fontSize)
  const setFontSize = useAppStore((s) => s.setFontSize)
  const currency = useCurrency()
  const setCurrency = useAppStore((s) => s.setCurrency)
  const lng = i18n.resolvedLanguage ?? 'zh-TW'
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const { hash } = useLocation()
  const navOrderRef = useRef<HTMLElement>(null)

  // 側邊欄「編輯排序」連到 /settings#nav-order，捲到排序區塊
  useEffect(() => {
    if (hash === '#nav-order') navOrderRef.current?.scrollIntoView?.({ block: 'start' })
  }, [hash])

  const download = () => downloadJson(exportData(), backupFileName())
  // 資料可攜：標準 .ics（其他行事曆 App 可以匯入）與共享空間 JSON；只含自己看得到的內容
  const calendarExport = useCalendarExport()
  const downloadIcs = () => downloadText(buildIcs(calendarExport.icsEvents(), { calendarName: t('app.name') }), icsFileName(), 'text/calendar;charset=utf-8')
  const downloadSpaces = () => downloadJson(calendarExport.spacesExport(), spacesFileName())

  const upload = async (file: File) => {
    if (!window.confirm(t('settings.importConfirm'))) return
    try {
      importData(JSON.parse(await file.text()))
      setMsg(t('settings.importOk'))
    } catch (e) {
      setMsg(t('settings.importFail', { msg: e instanceof Error ? e.message : String(e) }))
    }
  }

  return (
    <>
      <PageHead title={t('settings.title')} />
      <div className="grid max-w-xl grid-cols-[minmax(0,1fr)] gap-4">
        <section className="rounded-(--radius-card) bg-paper p-6 shadow-card">
          <h2 className="mb-3 font-bold">{t('settings.language')}</h2>
          <div role="radiogroup" aria-label={t('settings.language')} className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <Button key={l.code} role="radio" aria-checked={i18n.resolvedLanguage === l.code} variant={i18n.resolvedLanguage === l.code ? 'primary' : 'ghost'} onClick={() => void i18n.changeLanguage(l.code)}>
                {l.label}
              </Button>
            ))}
          </div>
        </section>
        <section className="rounded-(--radius-card) bg-paper p-6 shadow-card">
          <h2 className="mb-1 font-bold">{t('settings.currency.title')}</h2>
          <p className="mb-3 text-xs leading-relaxed text-muted">{t('settings.currency.help')}</p>
          <div role="radiogroup" aria-label={t('settings.currency.title')} className="grid grid-cols-2 gap-2 min-[520px]:grid-cols-4">
            {CURRENCIES.map((code) => {
              const on = currency === code
              const name = currencyName(code, lng)
              return (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${code} ${name}`}
                  onClick={() => setCurrency(code)}
                  className={`relative grid justify-items-center gap-0.5 rounded-(--radius-control) border px-2 py-3 transition ${on ? 'border-sage bg-sage-light text-sage-dark ring-2 ring-sage/25' : 'border-line bg-oat hover:bg-sage-light/60'}`}
                >
                  {on && (
                    <span aria-hidden className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-sage text-[10px] leading-none text-white">
                      <Icon name="check" className="size-[85%]" />
                    </span>
                  )}
                  <span aria-hidden className="text-lg leading-tight font-extrabold">
                    {currencySymbol(code, lng)}
                  </span>
                  <span className="text-xs font-bold">{code}</span>
                  <span className="text-center text-[length:calc(11px*var(--fs))] leading-tight text-muted">{name}</span>
                </button>
              )
            })}
          </div>
        </section>
        <section id="nav-order" ref={navOrderRef} className="scroll-mt-4 rounded-(--radius-card) bg-paper p-6 shadow-card">
          <h2 className="mb-1 font-bold">{t('settings.navOrder.title')}</h2>
          <p className="mb-3 text-xs leading-relaxed text-muted">{t('settings.navOrder.help')}</p>
          <NavOrderPanel section="collect" title={t('nav.sectionCollect')} />
        </section>
        <section className="rounded-(--radius-card) bg-paper p-6 shadow-card">
          <h2 className="mb-1 flex items-center gap-1.5 font-bold">
            <Icon name="reminders" /> {t('nav.reminders')}
          </h2>
          <p className="mb-3 text-xs text-muted">{t('reminders.settingsHelp')}</p>
          <Link to="/reminders" className="inline-block rounded-(--radius-control) border border-line bg-paper px-4 py-2.5 text-xs font-bold hover:bg-sage-light">
            {t('reminders.openPage')}
          </Link>
        </section>
        <section className="rounded-(--radius-card) bg-paper p-6 shadow-card">
          <h2 className="mb-1 flex items-center gap-1.5 font-bold">
            <Icon name="subscription" /> {t('nav.subscriptions')}
          </h2>
          <p className="mb-3 text-xs text-muted">{t('subs.settingsHelp')}</p>
          <Link to="/subscriptions" className="inline-block rounded-(--radius-control) border border-line bg-paper px-4 py-2.5 text-xs font-bold hover:bg-sage-light">
            {t('subs.openPage')}
          </Link>
        </section>
        <section className="rounded-(--radius-card) bg-paper p-6 shadow-card">
          <h2 className="mb-1 flex items-center gap-1.5 font-bold">
            <Icon name="inventory" /> {t('nav.inventory')}
          </h2>
          <p className="mb-3 text-xs text-muted">{t('inv.settingsHelp')}</p>
          <Link to="/inventory" className="inline-block rounded-(--radius-control) border border-line bg-paper px-4 py-2.5 text-xs font-bold hover:bg-sage-light">
            {t('inv.openPage')}
          </Link>
        </section>
        <section className="rounded-(--radius-card) bg-paper p-6 shadow-card">
          <h2 className="mb-3 font-bold">{t('sync.title')}</h2>
          <SyncPanel showHelp />
        </section>
        <SpacesPanel />
        <section className="rounded-(--radius-card) bg-paper p-6 shadow-card">
          <h2 className="mb-2 font-bold">{t('settings.data')}</h2>
          <p className="mb-2 text-xs leading-relaxed text-muted">{t('settings.dataHelp')}</p>
          <p className="mb-4 text-xs leading-relaxed text-muted">{t('settings.exportHelp')}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>{t('settings.export')}</Button>
            <Button variant="ghost" onClick={downloadIcs}>
              {t('settings.exportIcs')}
            </Button>
            <Button variant="ghost" onClick={downloadSpaces}>
              {t('settings.exportSpaces')}
            </Button>
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              {t('settings.import')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void upload(f)
                e.target.value = ''
              }}
            />
          </div>
          {msg && <p role="status" className="mt-3 text-xs text-sage-dark">{msg}</p>}
          <BackupPanel />
        </section>
        <section className="rounded-(--radius-card) bg-paper p-6 shadow-card">
          <h2 className="mb-1 font-bold">{t('settings.fontSize.title')}</h2>
          <p className="mb-3 text-xs text-muted">{t('settings.fontSize.help')}</p>
          <div role="radiogroup" aria-label={t('settings.fontSize.title')} className="grid grid-cols-2 gap-2 min-[520px]:grid-cols-4">
            {FONT_SIZES.map((size) => {
              const on = fontSize === size
              return (
                <button
                  key={size}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setFontSize(size)}
                  className={`relative grid justify-items-center gap-1 rounded-(--radius-control) border px-2 py-3 transition ${on ? 'border-sage bg-sage-light text-sage-dark ring-2 ring-sage/25' : 'border-line bg-oat hover:bg-sage-light/60'}`}
                >
                  {on && (
                    <span aria-hidden className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-sage text-[10px] leading-none text-white">
                      <Icon name="check" className="size-[85%]" />
                    </span>
                  )}
                  <span aria-hidden className="font-bold" style={{ fontSize: `${16 * FONT_SCALE[size]}px` }}>
                    Aa
                  </span>
                  <span className="text-xs font-bold">{t(`settings.fontSize.${size}`)}</span>
                </button>
              )
            })}
          </div>
        </section>
        <DeleteDataPanel />
        {/* 手機沒有側邊欄，隱私權政策與第三方授權清單的入口放在設定頁最底部 */}
        <div className="flex justify-center gap-4 py-2">
          <PrivacyLink />
          <LicensesLink />
        </div>
      </div>
    </>
  )
}
