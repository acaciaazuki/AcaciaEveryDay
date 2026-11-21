import type { TextareaHTMLAttributes } from 'react'

export function TextArea({ label, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-muted">
      {label}
      <textarea
        className="rounded-(--radius-control) border border-line bg-oat px-3 py-2.5 text-sm leading-relaxed font-normal text-ink outline-none focus:border-sage"
        {...props}
      />
    </label>
  )
}
