import { useTranslation } from 'react-i18next'
import { Button } from './Button'

/**
 * 行事曆「批次管理」的底部浮動操作列：已選數量、批次刪除、清除選取、完成。
 * 手機放在底部導覽列上方，桌面避開側邊欄。
 */
export function CalendarBatchBar({
  count,
  onDelete,
  onClear,
  onDone,
}: {
  count: number
  onDelete: () => void
  onClear: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const none = count === 0
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 flex justify-center min-[681px]:bottom-6 min-[681px]:left-60">
      <div
        role="toolbar"
        aria-label={t('calendar.manage.bar')}
        data-batch-bar
        className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-paper px-4 py-3 shadow-card"
      >
        <strong role="status" className="text-[length:calc(13px*var(--fs))] whitespace-nowrap text-sage-dark">
          {t('calendar.manage.selected', { count })}
        </strong>
        <Button variant="danger" disabled={none} onClick={onDelete}>
          {t('calendar.manage.delete')}
        </Button>
        <button type="button" disabled={none} onClick={onClear} className="text-xs font-semibold whitespace-nowrap text-muted hover:text-ink disabled:opacity-40">
          {t('calendar.manage.clear')}
        </button>
        <button type="button" onClick={onDone} className="text-xs font-bold whitespace-nowrap text-sage-dark hover:underline">
          {t('calendar.manage.done')}
        </button>
      </div>
    </div>
  )
}
