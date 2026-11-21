import { THEME_COLORS } from '../core/categories'

export function ColorSwatches({ value, onChange, label }: { value?: string; onChange: (c: { bg: string; txt: string }) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {THEME_COLORS.map((c) => {
        const on = (value ?? '#ffffff') === c.bg
        return (
          <button
            key={c.bg}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={c.bg}
            onClick={() => onChange(c)}
            className={`grid size-8 place-items-center rounded-full border text-xs font-bold ${on ? 'border-sage ring-2 ring-sage/30' : 'border-line'}`}
            style={{ background: c.bg, color: c.txt }}
          >
            A
          </button>
        )
      })}
    </div>
  )
}
