import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarEvent } from '../core/schema'
import { formatTimeRange } from '../core/time'
import { trashDaysLeft, trashedEvents } from '../core/trash'
import { useAppStore } from '../store/useAppStore'
import { purgeTrashNow } from '../store/trashPurge'
import { Button } from './Button'
import { Dialog } from './Dialog'

/**
 * 「最近刪除」：刪掉的行程在這裡保留 30 天，可以還原或永久刪除。打開時先清掉滿 30 天的。
 */
export function TrashDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const events = useAppStore((s) => s.events)
  const entries = useMemo(() => trashedEvents(events), [events])
  useEffect(() => purgeTrashNow(), [])
  // 打開時的時間：剩餘天數在對話框開著的期間不跳動
  const [now] = useState(() => Date.now())

  const restore = (e: CalendarEvent) => useAppStore.getState().restoreEvents([e])
  const purge = (e: CalendarEvent) => {
    if (!window.confirm(t('trash.purgeConfirm', { title: e.title }))) return
    useAppStore.getState().discardEvents([e.id])
  }
  const dateLabel = (e: CalendarEvent) => {
    const day = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium' }).format(new Date(`${e.dateISO}T00:00`))
    const time = formatTimeRange(e.start, e.end)
    return time ? `${day} ${time}` : day
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('trash.title')}>
      <p className="mb-4 text-[length:calc(13px*var(--fs))] text-muted">{t('trash.intro')}</p>
      {entries.length === 0 ? (
        <p data-trash-empty className="py-6 text-center text-[length:calc(13px*var(--fs))] text-muted">
          {t('trash.empty')}
        </p>
      ) : (
        <ul className="grid gap-2">
          {entries.map((e) => (
            <li key={e.id} data-trash-item={e.id} className="grid gap-2 rounded-(--radius-control) border border-line p-3">
              <div className="grid gap-0.5">
                <span className="truncate text-[length:calc(14px*var(--fs))] font-semibold">{e.title}</span>
                <span className="text-[length:calc(12px*var(--fs))] text-muted">{dateLabel(e)}</span>
                <span className="text-[length:calc(12px*var(--fs))] text-muted">{t('trash.daysLeft', { count: trashDaysLeft(e.deletedAt, now) })}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => restore(e)}>
                  {t('trash.restore')}
                </Button>
                <Button variant="danger" onClick={() => purge(e)}>
                  {t('trash.purge')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          {t('trash.close')}
        </Button>
      </div>
    </Dialog>
  )
}
