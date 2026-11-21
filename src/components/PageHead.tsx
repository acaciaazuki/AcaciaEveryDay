import type { ReactNode } from 'react'

export function PageHead({ eyebrow, title, actions }: { eyebrow: ReactNode; title: string; actions?: ReactNode }) {
  return (
    <div className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="mb-1.5 text-[11px] tracking-wide text-muted">{eyebrow}</div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}
