import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { SharedEntry } from '../core/calendarView'
import { useSharedTitle } from '../hooks/useSharedTitle'
import { formatTimeRange } from '../core/time'
import { Icon } from './AcaciaIcons'
import { Button } from './Button'
import { Dialog } from './Dialog'

/**
 * 共享空間行程在行事曆／今日頁的呈現。資料都是 useVisibleCalendar 過濾後的 SharedEntry，
 * 這裡只負責「怎麼顯示」：
 * - 完整：跟一般行程一樣，左側加空間色
 * - 忙閒（busy）：淡鼠尾草綠斜紋＋時鐘圖示，只寫 busyLabel 或「忙碌」
 * - 遮罩（masked）：一般外觀，加「部分隱藏」標記，被遮罩的欄位顯示「（已隱藏）」
 */

const BUSY_STYLE: CSSProperties = {
  background: 'repeating-linear-gradient(135deg, var(--color-sage-light) 0 6px, var(--color-paper) 6px 12px)',
  color: 'var(--color-muted)',
  borderColor: '#c8ddd3',
}

const SPACE_ACCENT = '#75b799'

function SpaceTag({ entry }: { entry: SharedEntry }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-paper/80 px-1.5 py-px text-[length:calc(10px*var(--fs))] font-bold text-sage-dark">{entry.space.name}</span>
  )
}

/** 月曆格子裡的小標籤 */
export function SharedChip({ entry, onOpen }: { entry: SharedEntry; onOpen: (x: SharedEntry) => void }) {
  const title = useSharedTitle()
  const busy = entry.access === 'busy'
  const style: CSSProperties = busy
    ? BUSY_STYLE
    : { background: entry.item.bgColor || '#eaf6ef', color: entry.item.titleColor || '#263633', borderColor: entry.space.color || SPACE_ACCENT }
  return (
    <button
      type="button"
      data-shared={entry.id}
      data-access={entry.access}
      onClick={(ev) => {
        ev.stopPropagation()
        onOpen(entry)
      }}
      className={`flex items-center gap-0.5 truncate rounded px-1.5 py-px text-left text-[length:calc(10px*var(--fs))] leading-4 font-semibold ${busy ? 'border' : 'border-l-2'}`}
      style={style}
    >
      {busy && <Icon name="clock" className="size-[1.3em] shrink-0" />}
      <span className="truncate">
        {entry.start && `${entry.start} `}
        {title(entry)}
      </span>
    </button>
  )
}

/** 清單、時間軸用的卡片 */
export function SharedCard({ entry, onOpen, compact = false }: { entry: SharedEntry; onOpen: (x: SharedEntry) => void; compact?: boolean }) {
  const { t } = useTranslation()
  const title = useSharedTitle()
  const busy = entry.access === 'busy'
  const note = entry.maskedFields.includes('note') ? '' : entry.item.note
  const style: CSSProperties = busy
    ? { ...BUSY_STYLE, borderLeftColor: '#a9c9bb' }
    : { background: entry.item.bgColor || '#f2f8f4', borderLeftColor: entry.space.color || entry.item.titleColor || SPACE_ACCENT }
  return (
    <button
      type="button"
      data-shared={entry.id}
      data-access={entry.access}
      onClick={() => onOpen(entry)}
      className={`w-full rounded-xl border-l-4 text-left transition hover:-translate-y-px ${compact ? 'px-3 py-2' : 'px-4 py-3'} ${busy ? 'border border-dashed' : ''}`}
      style={style}
    >
      <span className="flex flex-wrap items-center gap-1.5">
        {busy && <Icon name="clock" className="size-[1.4em] shrink-0" />}
        <strong className={`text-[length:calc(13px*var(--fs))] ${entry.maskedFields.includes('title') ? 'font-semibold text-muted italic' : ''}`} style={busy ? undefined : { color: entry.item.titleColor || 'var(--color-ink)' }}>
          {title(entry)}
        </strong>
        <SpaceTag entry={entry} />
        {entry.access === 'masked' && (
          <span className="rounded-full border border-line bg-paper px-1.5 py-px text-[length:calc(10px*var(--fs))] font-semibold text-muted">{t('sharing.partlyHidden')}</span>
        )}
      </span>
      <small className="block text-[length:calc(11px*var(--fs))] text-muted">
        {formatTimeRange(entry.start, entry.end) || t('event.allDay')}
        {entry.creatorName && ` · ${entry.creatorName}`}
        {note && ` · ${note}`}
      </small>
    </button>
  )
}

/** 唯讀詳情：忙閒、遮罩、別人的行程、預覽模式都只開這個，不會開編輯表單 */
export function SharedDetailDialog({ entry, previewing, onClose }: { entry: SharedEntry; previewing: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const title = useSharedTitle()
  const hidden = (f: 'location' | 'note' | 'kind' | 'details') => entry.maskedFields.includes(f)
  const reason = previewing ? t('sharing.readOnlyPreview') : entry.access === 'busy' ? t('sharing.readOnlyBusy') : entry.access === 'masked' ? t('sharing.readOnlyMasked') : t('sharing.readOnly')
  const row = (label: string, value: string, isHidden = false) => (
    <div className="grid grid-cols-[6em_1fr] gap-2 text-[length:calc(13px*var(--fs))]">
      <dt className="text-muted">{label}</dt>
      <dd className={isHidden ? 'text-muted italic' : ''}>{isHidden ? t('sharing.hiddenTitle') : value}</dd>
    </div>
  )
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={title(entry)}>
      <p role="note" className="mb-4 rounded-(--radius-control) bg-sage-light px-3 py-2 text-xs text-sage-dark">
        {reason}
      </p>
      <dl className="grid gap-2">
        {row(t('sharing.space'), entry.space.name)}
        {row(t('event.date'), entry.lastDateISO !== entry.dateISO ? `${entry.dateISO} – ${entry.lastDateISO}` : entry.dateISO)}
        {row(t('sharing.time'), formatTimeRange(entry.start, entry.end) || t('event.allDay'))}
        {entry.creatorName && row(t('sharing.createdBy'), entry.creatorName)}
        {entry.access !== 'busy' && (
          <>
            {row(t('sharing.kind'), t(`sharing.itemKind.${entry.kind}`), hidden('kind'))}
            {(entry.item.location || hidden('location')) && row(t('sharing.location'), entry.item.location, hidden('location'))}
            {(entry.item.note || hidden('note')) && row(t('sharing.note'), entry.item.note, hidden('note'))}
          </>
        )}
        {entry.projected && <p className="text-xs text-muted">{t('sharing.projectedHint')}</p>}
      </dl>
      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          {t('sharing.close')}
        </Button>
      </div>
    </Dialog>
  )
}
