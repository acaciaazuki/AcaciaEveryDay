import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost' | 'danger'
const styles: Record<Variant, string> = {
  primary: 'bg-sage text-white shadow-[0_4px_12px_#4a987b22] hover:bg-sage-dark',
  ghost: 'bg-paper text-ink border border-line hover:bg-sage-light',
  danger: 'bg-paper text-[#c2583d] border border-line hover:bg-[#fff4f1]',
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`rounded-(--radius-control) px-4 py-2.5 text-xs font-bold transition-colors disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  )
}
