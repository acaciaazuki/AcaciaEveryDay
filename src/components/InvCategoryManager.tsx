import { useId, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { countInCat, isDefaultInvCatOrder, validateCatName, type CatNameError } from '../core/invCategories'
import { INV_CAT_NAME_MAX } from '../core/schema'
import { useInvCategories } from '../hooks/useInvCategories'
import { INV_CATEGORY_NAMES } from '../i18n/cross'
import { useAppStore } from '../store/useAppStore'
import { Icon } from './AcaciaIcons'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { SortableList } from './SortableList'

/**
 * 自訂分類：輸入名稱新增、列出已有的自訂分類並可刪除。
 * 會放在用品表單（分類選「其他」時）裡，所以 Enter 只新增分類、不送出外層表單。
 */
export function CustomCatEditor({ onAdded, onRemoved }: { onAdded?: (id: string) => void; onRemoved?: (id: string) => void }) {
  const { t } = useTranslation()
  const uid = useId()
  const cats = useInvCategories()
  const inventory = useAppStore((s) => s.inventory)
  const addInvCategory = useAppStore((s) => s.addInvCategory)
  const removeInvCategory = useAppStore((s) => s.removeInvCategory)
  const [name, setName] = useState('')
  const [error, setError] = useState<CatNameError | null>(null)
  const custom = cats.list.filter((c) => !c.builtin)

  // 內建分類三種語言的名稱都不能拿來當自訂名稱，切換語言後才不會看到兩個「其他」
  const taken = () => [
    ...cats.list.map((c) => c.label),
    ...INV_CATEGORY_NAMES,
  ]

  const add = () => {
    const r = validateCatName(name, taken())
    if (!r.ok) return setError(r.error)
    const id = addInvCategory(r.name)
    setName('')
    setError(null)
    onAdded?.(id)
  }

  const remove = (id: string, label: string) => {
    const count = countInCat(inventory, cats.invCats, id)
    const msg = count > 0 ? t('inv.cats.deleteConfirmMove', { name: label, count, other: t('inv.cat.other') }) : t('inv.cats.deleteConfirm', { name: label })
    if (!window.confirm(msg)) return
    removeInvCategory(id)
    onRemoved?.(id)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      add()
    }
  }

  return (
    <div className="grid gap-2.5 rounded-(--radius-control) border border-dashed border-sage/50 bg-[#f6fbf8] p-3">
      <label htmlFor={`${uid}-name`} className="text-xs font-bold text-sage-dark">
        {t('inv.cats.customTitle')}
      </label>
      <div className="flex gap-2">
        <input
          id={`${uid}-name`}
          value={name}
          maxLength={INV_CAT_NAME_MAX * 2}
          placeholder={t('inv.cats.namePlaceholder')}
          aria-invalid={!!error}
          aria-describedby={`${uid}-hint`}
          onChange={(e) => {
            setName(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={onKeyDown}
          className="w-full min-w-0 flex-1 rounded-(--radius-control) border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-sage aria-invalid:border-[#c2583d]"
        />
        <Button className="shrink-0 px-3!" onClick={add}>
          {t('inv.cats.add')}
        </Button>
      </div>
      <p id={`${uid}-hint`} className={`text-[length:calc(11px*var(--fs))] ${error ? 'text-[#c2583d]' : 'text-muted'}`} aria-live="polite">
        {error ? t(`inv.cats.error.${error}`, { max: INV_CAT_NAME_MAX }) : t('inv.cats.hint', { max: INV_CAT_NAME_MAX })}
      </p>
      {custom.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t('inv.cats.customList')}>
          {custom.map((c) => (
            <li key={c.key} className="inline-flex items-center gap-1 rounded-full py-0.5 pr-0.5 pl-2.5 text-xs font-semibold" style={{ background: c.bg, color: c.fg }}>
              <Icon name={c.icon} className="size-[1.3em]" />
              {c.label}
              <button
                type="button"
                aria-label={t('inv.cats.deleteAria', { name: c.label })}
                onClick={() => remove(c.key, c.label)}
                className="grid size-7 place-items-center rounded-full hover:bg-paper/80"
              >
                <Icon name="close" className="size-[1.1em]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 分類設定：調整分類順序（拖曳、方向鍵、上下按鈕）、恢復預設、新增與刪除自訂分類 */
export function InvCategoryDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const cats = useInvCategories()
  const setInvCatOrder = useAppStore((s) => s.setInvCatOrder)
  const keys = cats.list.map((c) => c.key)
  const isDefault = isDefaultInvCatOrder(cats.invCats, keys)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('inv.cats.title')}>
      <div className="grid gap-4">
        <section className="grid gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold">{t('inv.cats.orderTitle')}</h3>
            <Button variant="ghost" className="px-3! py-1.5!" disabled={isDefault} onClick={() => setInvCatOrder(null)}>
              {t('inv.cats.reset')}
            </Button>
          </div>
          <p className="-mt-1 text-[length:calc(11px*var(--fs))] text-muted">{t('inv.cats.orderHint')}</p>
          <SortableList
            label={t('inv.cats.orderTitle')}
            items={cats.list.map((c) => ({ id: c.key, label: c.label, icon: c.icon }))}
            // 跟預設一樣時不存，之後新增的內建分類才會出現在預設位置
            onChange={(next) => setInvCatOrder(isDefaultInvCatOrder(cats.invCats, next) ? null : next)}
          />
        </section>
        <CustomCatEditor />
        <div className="flex justify-end">
          <Button onClick={onClose}>{t('inv.cats.done')}</Button>
        </div>
      </div>
    </Dialog>
  )
}
