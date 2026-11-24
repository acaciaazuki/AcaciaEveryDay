import { useEffect } from 'react'
import { Icon } from './AcaciaIcons'

/**
 * 輕量提示：畫面下方淡淡出現，幾秒後自動消失。手機版會避開底部導覽列。
 * action：提示旁的操作按鈕（例如批次建立後的「復原」），按下後提示關閉。
 */
export function Toast({
  message,
  onDone,
  duration = 2600,
  action,
}: {
  message: string
  onDone: () => void
  duration?: number
  action?: { label: string; onClick: () => void }
}) {
  useEffect(() => {
    const id = setTimeout(onDone, duration)
    return () => clearTimeout(id)
  }, [message, onDone, duration])

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(92px+env(safe-area-inset-bottom))] z-[60] grid justify-items-center min-[681px]:bottom-8 min-[681px]:left-60">
      <div role="status" className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-2.5 text-[length:calc(13px*var(--fs))] font-semibold text-sage-dark shadow-card">
        <span className="grid size-6 place-items-center rounded-full bg-sage-light" aria-hidden>
          <Icon name="check" className="size-[1.2em]" />
        </span>
        {message}
        {action && (
          <button
            type="button"
            onClick={() => {
              action.onClick()
              onDone()
            }}
            className="-mr-1.5 ml-1 rounded-full bg-sage-light px-3 py-1 text-[length:calc(12px*var(--fs))] font-bold text-sage-dark hover:bg-mint"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
