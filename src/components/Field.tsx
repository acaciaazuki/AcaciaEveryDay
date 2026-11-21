import type { InputHTMLAttributes } from 'react'

export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-muted">
      {label}
      <input
        className="rounded-(--radius-control) border border-line bg-oat px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-sage"
        {...props}
      />
    </label>
  )
}
