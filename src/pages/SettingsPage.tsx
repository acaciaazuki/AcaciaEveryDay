import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/Button'
import { PageHead } from '../components/PageHead'
import { SyncPanel } from '../components/SyncPanel'
import { LANGUAGES } from '../i18n'
import { useAppStore } from '../store/useAppStore'

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const importData = useAppStore((s) => s.importData)
  const exportData = useAppStore((s) => s.exportData)
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  const download = () => {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `acacia-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

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
      <PageHead eyebrow={t('settings.eyebrow')} title={t('settings.title')} />
      <div className="grid max-w-xl gap-4">
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
          <h2 className="mb-1 font-bold">🎒 {t('nav.reminders')}</h2>
          <p className="mb-3 text-xs text-muted">{t('reminders.settingsHelp')}</p>
          <Link to="/reminders" className="inline-block rounded-(--radius-control) border border-line bg-paper px-4 py-2.5 text-xs font-bold hover:bg-sage-light">
            {t('reminders.openPage')}
          </Link>
        </section>
        <section className="rounded-(--radius-card) bg-paper p-6 shadow-card">
          <h2 className="mb-3 font-bold">{t('sync.title')}</h2>
          <SyncPanel showHelp />
        </section>
        <section className="rounded-(--radius-card) bg-paper p-6 shadow-card">
          <h2 className="mb-2 font-bold">{t('settings.data')}</h2>
          <p className="mb-4 text-xs leading-relaxed text-muted">{t('settings.dataHelp')}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>{t('settings.export')}</Button>
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
        </section>
      </div>
    </>
  )
}
