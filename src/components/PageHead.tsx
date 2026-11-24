import type { ReactNode } from 'react'

/**
 * 頁面標頭：小字（eyebrow）、大標題、右側操作。
 * titleClassName／eyebrowClassName 可以讓個別頁面調整字級（預設跟原本一樣）。
 */
export function PageHead({
  eyebrow,
  title,
  actions,
  titleClassName = 'text-2xl',
  eyebrowClassName = 'text-[length:calc(11px*var(--fs))]',
}: {
  eyebrow: ReactNode
  title: string
  actions?: ReactNode
  titleClassName?: string
  eyebrowClassName?: string
}) {
  return (
    <div className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className={`mb-1.5 tracking-wide text-muted ${eyebrowClassName}`}>{eyebrow}</div>
        <h1 className={`font-extrabold tracking-tight ${titleClassName}`}>{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
