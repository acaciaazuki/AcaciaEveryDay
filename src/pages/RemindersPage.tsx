import { Icon } from '../components/AcaciaIcons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { notifyState, requestNotify, type NotifyState } from '../adapters/notify'
import { Button } from '../components/Button'
import { PageHead } from '../components/PageHead'
import { ReminderDialog } from '../components/ReminderDialog'
import { whenText } from '../components/reminderText'
import { hasCoords } from '../core/reminders'
import type { Reminder } from '../core/schema'
import { fireReminder } from '../hooks/useReminderMonitor'
import { useOpenFromUrl } from '../hooks/useOpenFromUrl'
import { useAppStore } from '../store/useAppStore'
import { useReminderRuntime } from '../store/useReminderRuntime'

export function RemindersPage() {
  const { t, i18n } = useTranslation()
  const reminders = useAppStore((s) => s.reminders)
  const updateReminder = useAppStore((s) => s.updateReminder)
  const removeReminder = useAppStore((s) => s.removeReminder)
  const status = useReminderRuntime((s) => s.status)
  const [editing, setEditing] = useState<Reminder | 'new' | null>(null)
  const [notify, setNotify] = useState<NotifyState>(notifyState)
  useOpenFromUrl(reminders, setEditing)

  return (
    <>
      <PageHead eyebrow={t('reminders.eyebrow')} title={t('reminders.title')} actions={<Button onClick={() => setEditing('new')}>{t('reminders.add')}</Button>} />

      <section className="mb-4 grid gap-2 rounded-2xl border border-line bg-paper p-4 text-xs shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span role="status">{t(`reminders.status.${status}`)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{t(`reminders.status.notify.${notify}`)}</span>
          {notify === 'default' && (
            <Button variant="ghost" onClick={() => void requestNotify().then(setNotify)}>
              {t('reminders.status.enableNotify')}
            </Button>
          )}
        </div>
        <p className="text-muted">{t('reminders.status.webNote')}</p>
      </section>

      {reminders.length === 0 ? (
        <div className="rounded-(--radius-card) bg-paper p-10 text-center text-muted shadow-card">{t('reminders.empty')}</div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {reminders.map((r) => (
            <li key={r.id} className={`grid content-start gap-3 rounded-(--radius-card) bg-paper p-5 shadow-card ${r.enabled ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex min-w-0 items-center gap-1.5 text-base font-bold">
                    <Icon name="pin" className="text-[#5f7a70]" />
                    <span className="truncate">{r.place}</span>
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {t(`reminders.card.${r.trigger}`)} · {t('reminders.card.radius', { m: r.radius })}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={r.enabled}
                  aria-label={`${t('reminders.card.enable')}：${r.place}`}
                  onClick={() => updateReminder(r.id, { enabled: !r.enabled })}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${r.enabled ? 'bg-sage' : 'bg-[#d5ddd9]'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${r.enabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              <p className="text-xs font-semibold text-[#55645d]">{whenText(t, i18n.resolvedLanguage, r) + (r.start || r.end ? '' : ` · ${t('reminders.card.allDay')}`)}</p>
              <ul className="flex flex-wrap gap-1.5">
                {r.items.map((item) => (
                  <li key={item} className="rounded-full bg-sage-light px-3 py-1 text-xs font-semibold text-sage-dark">
                    {item}
                  </li>
                ))}
              </ul>
              {!hasCoords(r) && <p className="rounded-lg bg-weekend px-3 py-2 text-[length:calc(11px*var(--fs))] text-[#7a6232]">{t('reminders.card.noCoords')}</p>}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => fireReminder({ reminder: r, kind: r.trigger })}>
                  {t('reminders.card.test')}
                </Button>
                <Button variant="ghost" className="ml-auto" onClick={() => setEditing(r)}>
                  {t('reminders.card.edit')}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (window.confirm(t('reminders.card.deleteConfirm'))) removeReminder(r.id)
                  }}
                >
                  {t('reminders.card.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && <ReminderDialog key={editing === 'new' ? 'new' : editing.id} reminder={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
