import type { ReactNode } from 'react'

/** 全站頁面主標題字級：跟「今天」頁的問候一樣小（13px），跟著設定裡的字體大小縮放 */
export const PAGE_TITLE_SIZE = 'text-[length:calc(13px*var(--fs))]'

/**
 * 頁面標頭：主標題、右側操作。
 * - 頁面不再顯示標語小字；eyebrow 只給有功能的列使用（例如「今天」頁的日期切換），沒傳就完全不輸出、不留空白
 * - 主標題全站統一用 PAGE_TITLE_SIZE；標題變小後跟右側按鈕垂直置中
 */
export function PageHead({
  eyebrow,
  title,
  actions,
  eyebrowClassName = 'text-[length:calc(11px*var(--fs))]',
}: {
  eyebrow?: ReactNode
  title: string
  actions?: ReactNode
  eyebrowClassName?: string
}) {
  return (
    <div data-page-head className="mt-4 mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        {eyebrow && <div className={`mb-1.5 tracking-wide text-muted ${eyebrowClassName}`}>{eyebrow}</div>}
        <h1 className={`font-extrabold tracking-tight ${PAGE_TITLE_SIZE}`}>{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
