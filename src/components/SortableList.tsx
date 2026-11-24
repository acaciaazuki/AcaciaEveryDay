import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { IconName } from '../core/icons'
import { moveItem } from '../core/navOrder'
import { Icon } from './AcaciaIcons'

export interface SortableItem {
  id: string
  label: string
  icon?: IconName
}

interface Props {
  items: SortableItem[]
  /** 新的 id 順序 */
  onChange: (ids: string[]) => void
  /** 清單的無障礙名稱 */
  label: string
}

type Focus = { id: string; target: 'handle' | 'up' | 'down' }

/**
 * 可重新排序的清單：
 * - 拖曳左邊的把手（滑鼠與觸控都可以，用 Pointer Events）
 * - 把手取得焦點時，用 ↑ ↓ 方向鍵移動
 * - 每列右邊的上移／下移按鈕（手機與螢幕閱讀器）
 * 每次移動都會用 aria-live 念出新位置。
 */
export function SortableList({ items, onChange, label }: Props) {
  const { t } = useTranslation()
  const helpId = useId()
  const [draft, setDraft] = useState<string[] | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const rows = useRef(new Map<string, HTMLLIElement>())
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const pendingFocus = useRef<Focus | null>(null)

  const byId = new Map(items.map((i) => [i.id, i]))
  const ids = draft ?? items.map((i) => i.id)
  const list = ids.map((id) => byId.get(id)).filter((i): i is SortableItem => !!i)

  // 移動後焦點留在同一列；按鈕到頂／到底變成停用時，改把焦點放到把手
  useEffect(() => {
    const f = pendingFocus.current
    if (!f) return
    pendingFocus.current = null
    const btn = buttons.current.get(`${f.id}:${f.target}`)
    if (btn && !btn.disabled) btn.focus()
    else buttons.current.get(`${f.id}:handle`)?.focus()
  })

  const say = (id: string, to: number) => setAnnounce(t('sortable.moved', { label: byId.get(id)?.label ?? '', pos: to + 1, total: ids.length }))

  const move = (id: string, delta: number, target: Focus['target']) => {
    const from = ids.indexOf(id)
    const to = from + delta
    if (to < 0 || to >= ids.length) return
    pendingFocus.current = { id, target }
    onChange(moveItem(ids, from, to))
    say(id, to)
  }

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDragId(id)
    setDraft(items.map((i) => i.id))
  }

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!dragId || !draft) return
    // 其他列中，中線在指標上方的數量就是拖曳項目的新位置
    const others = draft.filter((id) => id !== dragId)
    let to = 0
    for (const id of others) {
      const r = rows.current.get(id)?.getBoundingClientRect()
      if (r && e.clientY > r.top + r.height / 2) to++
    }
    const from = draft.indexOf(dragId)
    if (to !== from) setDraft(moveItem(draft, from, to))
  }

  const endDrag = (commit: boolean) => {
    if (dragId && draft && commit) {
      const before = items.map((i) => i.id)
      if (draft.some((id, i) => id !== before[i])) {
        onChange(draft)
        say(dragId, draft.indexOf(dragId))
      }
    }
    setDragId(null)
    setDraft(null)
  }

  const onHandleKey = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      move(id, e.key === 'ArrowUp' ? -1 : 1, 'handle')
    }
  }

  const setBtn = (key: string) => (el: HTMLButtonElement | null) => {
    if (el) buttons.current.set(key, el)
    else buttons.current.delete(key)
  }

  const iconBtn =
    'grid size-10 shrink-0 place-items-center rounded-(--radius-control) border border-line bg-paper text-sage-dark transition-colors hover:bg-sage-light disabled:cursor-default disabled:opacity-35 disabled:hover:bg-paper'

  return (
    <>
      <ol aria-label={label} className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {list.map((item, index) => {
          const dragging = dragId === item.id
          return (
            <li
              key={item.id}
              ref={(el) => {
                if (el) rows.current.set(item.id, el)
                else rows.current.delete(item.id)
              }}
              className={`flex items-center gap-2 rounded-(--radius-control) border px-2 py-1.5 transition-shadow ${
                dragging ? 'border-sage bg-sage-light shadow-soft ring-2 ring-sage/25' : 'border-line bg-oat'
              }`}
            >
              <button
                type="button"
                ref={setBtn(`${item.id}:handle`)}
                aria-label={t('sortable.handle', { label: item.label })}
                aria-describedby={helpId}
                title={t('sortable.handleTitle')}
                onPointerDown={(e) => onPointerDown(e, item.id)}
                onPointerMove={onPointerMove}
                onPointerUp={() => endDrag(true)}
                onPointerCancel={() => endDrag(false)}
                onKeyDown={(e) => onHandleKey(e, item.id)}
                className={`grid size-10 shrink-0 touch-none place-items-center rounded-(--radius-control) text-[#9aa6a0] select-none hover:bg-paper hover:text-sage-dark ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="currentColor">
                  {[6, 10, 14].flatMap((y) => [7, 13].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
                </svg>
              </button>
              <span aria-hidden className="w-5 text-center text-xs font-bold text-[#a4afaa]">{index + 1}</span>
              {item.icon && <Icon name={item.icon} className="size-[1.9em] shrink-0" />}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.label}</span>
              <button
                type="button"
                ref={setBtn(`${item.id}:up`)}
                aria-label={t('sortable.up', { label: item.label })}
                disabled={index === 0}
                onClick={() => move(item.id, -1, 'up')}
                className={iconBtn}
              >
                <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5 10 7.5l5 5" />
                </svg>
              </button>
              <button
                type="button"
                ref={setBtn(`${item.id}:down`)}
                aria-label={t('sortable.down', { label: item.label })}
                disabled={index === list.length - 1}
                onClick={() => move(item.id, 1, 'down')}
                className={iconBtn}
              >
                <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 7.5 5 5 5-5" />
                </svg>
              </button>
            </li>
          )
        })}
      </ol>
      <p id={helpId} className="sr-only">
        {t('sortable.keyboardHelp')}
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </>
  )
}
