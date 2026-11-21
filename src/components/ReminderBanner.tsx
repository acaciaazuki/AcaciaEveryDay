import { useTranslation } from 'react-i18next'
import { useReminderRuntime } from '../store/useReminderRuntime'
import { Button } from './Button'

/** 進出範圍時跳出的提醒：列出要確認的隨身物品，可以勾選已帶齊 */
export function ReminderBanner() {
  const { t } = useTranslation()
  const alerts = useReminderRuntime((s) => s.alerts)
  const toggleItem = useReminderRuntime((s) => s.toggleItem)
  const dismiss = useReminderRuntime((s) => s.dismiss)
  if (alerts.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[60] grid justify-items-center gap-2 min-[681px]:inset-x-auto min-[681px]:right-6 min-[681px]:justify-items-end">
      {alerts.map((a) => {
        const all = a.items.length > 0 && a.checked.length === a.items.length
        return (
          <section key={a.id} role="alert" className="pointer-events-auto w-full max-w-sm rounded-(--radius-card) border border-line bg-paper p-4 shadow-card">
            <div className="mb-2 flex items-start gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-weekend text-lg" aria-hidden>
                🎒
              </span>
              <h2 className="flex-1 pt-1 text-sm font-bold">{t(`reminders.banner.${a.kind}`, { place: a.place })}</h2>
              <button type="button" aria-label={t('reminders.banner.close')} onClick={() => dismiss(a.id)} className="grid size-7 place-items-center rounded-full text-muted hover:bg-oat">
                ✕
              </button>
            </div>
            <ul className="mb-3 grid gap-1.5">
              {a.items.map((item) => {
                const on = a.checked.includes(item)
                return (
                  <li key={item}>
                    <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg bg-oat px-3 py-2 text-[length:calc(13px*var(--fs))] ${on ? 'text-muted line-through' : 'font-semibold'}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleItem(a.id, item)} className="size-4 accent-[#4a987b]" />
                      {item}
                    </label>
                  </li>
                )
              })}
            </ul>
            <Button className="w-full" variant={all ? 'primary' : 'ghost'} onClick={() => dismiss(a.id)}>
              {t('reminders.banner.done')}
            </Button>
          </section>
        )
      })}
    </div>
  )
}
