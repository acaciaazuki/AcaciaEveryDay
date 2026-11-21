import { useTranslation } from 'react-i18next'
import { TEXT_COLORS, THEME_COLORS } from '../core/categories'

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

/** 文字顏色色票：和卡片背景色分開選 */
export function TextColorSwatches({ value, onChange, label }: { value?: string; onChange: (color: string) => void; label: string }) {
  const { t } = useTranslation()
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {TEXT_COLORS.map((c) => {
        const on = value?.toLowerCase() === c.color
        return (
          <button
            key={c.color}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={t(`colors.text.${c.key}`)}
            title={t(`colors.text.${c.key}`)}
            onClick={() => onChange(c.color)}
            className={`grid size-8 place-items-center rounded-full border ${on ? 'border-sage ring-2 ring-sage/30' : 'border-line'}`}
          >
            <span className="size-4.5 rounded-full" style={{ background: c.color }} />
          </button>
        )
      })}
    </div>
  )
}
