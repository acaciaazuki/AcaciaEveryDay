import type { ReactNode } from 'react'

export function PageHead({ eyebrow, title, actions }: { eyebrow: string; title: string; actions?: ReactNode }) {
  return (
    <div className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="mb-1.5 text-[11px] tracking-wide text-muted">{eyebrow}</p>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}
