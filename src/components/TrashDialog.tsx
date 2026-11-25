import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTimeRange } from '../core/time'
import { trashDaysLeft, type TrashEntry } from '../core/trash'
import { useTrashEntries } from '../hooks/useVisibleCalendar'
import { useAppStore } from '../store/useAppStore'
import { useSpacesStore } from '../store/useSpacesStore'
import { purgeTrashNow } from '../store/trashPurge'
import { Button } from './Button'
import { Dialog } from './Dialog'

/**
 * 「最近刪除」：刪掉的行程（我的行事曆與共享空間）在這裡保留 30 天，可以還原或永久刪除。
 * 打開時先清掉滿 30 天的。預覽其他成員的視角時不顯示任何內容（只有本人能管理自己的刪除紀錄）。
 */
export function TrashDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const selfId = useSpacesStore((s) => s.selfId)
  const entries = useTrashEntries()
  useEffect(() => purgeTrashNow(), [])
  // 打開時的時間：剩餘天數在對話框開著的期間不跳動
  const [now] = useState(() => Date.now())

  const nameOf = (e: { deletedBy: string; deletedByName?: string }) => (e.deletedBy === selfId ? t('trash.byMe') : e.deletedByName || t('trash.byOther'))
  const restore = (e: TrashEntry) => {
    if (e.kind === 'personal') useAppStore.getState().restoreEvents([e.event])
    else useSpacesStore.getState().restoreItem(e.id)
  }
  const purge = (e: TrashEntry) => {
    if (!window.confirm(t('trash.purgeConfirm', { title: e.title || t('sharing.hiddenTitle') }))) return
    if (e.kind === 'personal') useAppStore.getState().discardEvents([e.id])
    else useSpacesStore.getState().discardItem(e.id)
  }
  const dateLabel = (e: TrashEntry) => {
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
            <li key={`${e.kind}:${e.id}`} data-trash-item={e.id} className="grid gap-2 rounded-(--radius-control) border border-line p-3">
              <div className="grid gap-0.5">
                <span className="truncate text-[length:calc(14px*var(--fs))] font-semibold">{e.title || t('sharing.hiddenTitle')}</span>
                <span className="text-[length:calc(12px*var(--fs))] text-muted">
                  {dateLabel(e)} · {e.kind === 'personal' ? t('sharing.myCalendar') : e.spaceName}
                </span>
                <span className="text-[length:calc(12px*var(--fs))] text-muted">
                  {t('trash.daysLeft', { count: trashDaysLeft(e.deletedAt, now) })}
                  {e.kind === 'shared' && ` · ${t('trash.deletedBy', { name: nameOf(e) })}`}
                </span>
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
