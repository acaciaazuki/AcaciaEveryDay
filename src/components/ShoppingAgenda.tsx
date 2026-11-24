import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { shoppingPath, type ShoppingEntry } from '../core/shoppingAgenda'
import { formatTime } from '../core/time'
import { SHOP_STYLE, useEntryMoney, useShoppingLabel } from '../hooks/useShoppingAgenda'
import { Icon, IconBadge } from './AcaciaIcons'
import { Button } from './Button'
import { Dialog } from './Dialog'

function Tag() {
  const { t } = useTranslation()
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px text-[length:calc(10px*var(--fs))] font-bold" style={{ background: SHOP_STYLE.tagBg, color: SHOP_STYLE.fg }}>
      <Icon name="shopping" className="size-[1.3em]" />
      {t('calendar.shopping.tag')}
    </span>
  )
}

/** 月曆格子裡的小標籤 */
export function ShoppingChip({ entry, onOpen }: { entry: ShoppingEntry; onOpen: (x: ShoppingEntry) => void }) {
  const label = useShoppingLabel()
  const done = entry.expense.done
  return (
    <button
      type="button"
      data-shopping={entry.id}
      onClick={(ev) => {
        ev.stopPropagation()
        onOpen(entry)
      }}
      className={`flex items-center gap-0.5 truncate rounded border border-dashed px-1 py-px text-left text-[length:calc(10px*var(--fs))] leading-4 font-semibold ${done ? 'line-through opacity-60' : ''}`}
      style={{ background: SHOP_STYLE.bg, borderColor: SHOP_STYLE.border, color: SHOP_STYLE.fg }}
    >
      <Icon name="shopping" className="size-[1.3em] shrink-0" />
      {/* 格子很窄，省略時間讓名稱先露出來；順序已經依時間排好，時間在右側清單與詳情看得到 */}
      <span className="truncate">{label(entry)}</span>
    </button>
  )
}

/** 日期清單、一週兩週檢視、今天時間軸共用的卡片（時間一律 24 小時制） */
export function ShoppingCard({ entry, onOpen, compact = false }: { entry: ShoppingEntry; onOpen: (x: ShoppingEntry) => void; compact?: boolean }) {
  const { t } = useTranslation()
  const label = useShoppingLabel()
  const done = entry.expense.done
  return (
    <button
      type="button"
      data-shopping={entry.id}
      onClick={() => onOpen(entry)}
      className={`w-full rounded-xl border border-dashed text-left transition hover:-translate-y-px ${compact ? 'px-3 py-2' : 'px-4 py-3'} ${done ? 'opacity-60' : ''}`}
      style={{ background: SHOP_STYLE.bg, borderColor: SHOP_STYLE.border }}
    >
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <Tag />
        <strong className={`min-w-0 break-words text-[length:calc(13px*var(--fs))] ${done ? 'line-through' : ''}`} style={{ color: SHOP_STYLE.fg }}>
          {label(entry)}
        </strong>
      </span>
      <small className="mt-0.5 block text-[length:calc(11px*var(--fs))] text-muted">
        {entry.expense.time ? formatTime(entry.expense.time) : t('calendar.shopping.allDay')}
        {done && ` · ${t('calendar.shopping.done')}`}
        {entry.archived && ` · ${t('calendar.shopping.archived')}`}
      </small>
    </button>
  )
}

/** 時間軸左側的圓形購物徽章 */
export const ShoppingBadge = ({ className = '' }: { className?: string }) => <IconBadge name="shopping" bg={SHOP_STYLE.tagBg} className={className} />

/** 點購物行程時的唯讀詳情：不能在行事曆修改或刪除，只提供前往購物清單 */
export function ShoppingDetailDialog({ entry, onClose }: { entry: ShoppingEntry; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const money = useEntryMoney()
  const lng = i18n.resolvedLanguage
  const e = entry.expense
  const cat = e.cat === 'other' && e.customCat ? e.customCat : t(`expenseCat.${e.cat}`)
  const date = new Intl.DateTimeFormat(lng, { dateStyle: 'full' }).format(new Date(`${e.date}T00:00`))
  const rows: [string, string][] = [
    [t('shopping.form.title'), e.title],
    [t('shopping.form.store'), e.store || t('shopping.noStore')],
    [t('shopping.form.amt'), money(entry)],
    [t('shopping.form.cat'), cat],
    [t('shopping.form.date'), date],
    [t('shopping.form.time'), e.time ? formatTime(e.time) : t('calendar.shopping.allDay')],
  ]
  if (e.note) rows.push([t('shopping.form.note'), e.note])
  if (e.done) rows.push([t('calendar.shopping.status'), t('calendar.shopping.done')])

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('calendar.shopping.linkedTitle')}>
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-dashed p-3" style={{ background: SHOP_STYLE.bg, borderColor: SHOP_STYLE.border }}>
        <ShoppingBadge />
        <p className="text-[length:calc(12px*var(--fs))] leading-relaxed" style={{ color: SHOP_STYLE.fg }}>
          {entry.archived ? t('calendar.shopping.archivedHint') : t('calendar.shopping.readOnlyHint')}
        </p>
      </div>
      <dl className="mb-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-semibold text-muted">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" className="ml-auto" onClick={onClose}>
          {t('calendar.shopping.close')}
        </Button>
        <Button
          className="inline-flex items-center gap-1"
          onClick={() => {
            onClose()
            navigate(shoppingPath(entry))
          }}
        >
          <Icon name="shopping" className="size-[1.4em]" />
          {entry.archived ? t('calendar.shopping.goView') : t('calendar.shopping.goEdit')}
        </Button>
      </div>
    </Dialog>
  )
}
