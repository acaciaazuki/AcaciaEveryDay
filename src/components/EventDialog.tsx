import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { SharedEntry } from '../core/calendarView'
import { useBusyConflicts } from '../hooks/useVisibleCalendar'
import { toLocalISO } from '../core/date'
import { EVENT_ICON_KEYS, eventIconOf, ICON_BG } from '../core/eventIcons'
import type { CalendarEvent } from '../core/schema'
import { cleanDetails } from '../core/itemDetails'
import { defaultVisibility, orderedKinds, PERSONAL_CALENDAR_ID, roleOf } from '../core/sharing'
import { useAppStore } from '../store/useAppStore'
import { useSpacesStore } from '../store/useSpacesStore'
import { showToast } from '../store/useToastStore'
import { checkEnd, shiftEndDate } from '../core/span'
import { formatTimeRange, isAllDay } from '../core/time'
import { AllDayToggle } from './AllDayToggle'
import { Button } from './Button'
import { ColorSwatches, TextColorSwatches } from './ColorSwatches'
import { Dialog } from './Dialog'
import { EventIconArt } from './EventIcon'
import { Field } from './Field'
import { SharingFields, type SharedDraft } from './SharingFields'
import { TimeField } from './TimeField'

type Draft = Omit<CalendarEvent, 'id'>

/** 共享行程轉成表單共用的欄位 */
const draftOfShared = (x: SharedEntry): Draft => ({
  title: x.item.title,
  dateISO: x.item.dateISO,
  endDateISO: x.item.endDateISO,
  start: x.item.start,
  end: x.item.end,
  note: x.item.note,
  titleColor: x.item.titleColor,
  bgColor: x.item.bgColor,
  icon: x.item.icon,
})

/**
 * 行程新增 / 編輯，今天頁與行事曆共用。
 * - 「放在哪裡」選「我的行事曆」時跟原本一樣存進個人行程（useAppStore）
 * - 選共享空間時多出類型、地點與隱私設定，存進 useSpacesStore（所有權限檢查在 store 裡）
 * - 只有能編輯的共享行程才會打開這個對話框；忙閒、遮罩或預覽中的行程開的是唯讀詳情
 */
export function EventDialog({ event, shared, date, onClose }: { event: CalendarEvent | null; shared?: SharedEntry; date?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const addEvent = useAppStore((s) => s.addEvent)
  const updateEvent = useAppStore((s) => s.updateEvent)
  const removeEvent = useAppStore((s) => s.removeEvent)
  const selfId = useSpacesStore((s) => s.selfId)
  const allSpaces = useSpacesStore((s) => s.data.spaces)
  const addItem = useSpacesStore((s) => s.addItem)
  const updateItem = useSpacesStore((s) => s.updateItem)
  const removeItem = useSpacesStore((s) => s.removeItem)
  // 可以新增行程的空間：自己是 owner 或 editor
  const writable = allSpaces.filter((s) => ['owner', 'editor'].includes(roleOf(s, selfId) ?? ''))
  const editing = !!event || !!shared
  const [target, setTarget] = useState<string>(shared?.space.id ?? 'personal')
  const space = allSpaces.find((s) => s.id === target)
  const [sharedDraft, setSharedDraft] = useState<SharedDraft>(() =>
    shared
      ? { kind: shared.item.kind, location: shared.item.location, details: shared.item.details, visibility: shared.item.visibility }
      : { kind: 'event', location: '', details: {}, visibility: defaultVisibility() },
  )
  const [draft, setDraft] = useState<Draft>(
    event ?? (shared && draftOfShared(shared)) ?? { title: '', dateISO: date ?? toLocalISO(), start: '09:00', end: '10:00', note: '', titleColor: '#3d876c', bgColor: '#eaf6ef' },
  )
  // 整天：不存時間；切回來時還原原本填的時間
  const initialTimes = event ?? (shared && { start: shared.item.start, end: shared.item.end })
  const [allDay, setAllDay] = useState(() => !!initialTimes && isAllDay(initialTimes))
  const [times, setTimes] = useState(() => (initialTimes && !isAllDay(initialTimes) ? { start: initialTimes.start, end: initialTimes.end } : { start: '09:00', end: '10:00' }))
  const [error, setError] = useState('')
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  // 同一天、結束時間早於開始時間：提示會跨過午夜，結束在隔天（儲存時自動處理，不擋下）
  const endCheck = checkEnd({ dateISO: draft.dateISO, endDateISO: draft.endDateISO ?? '', start: allDay ? '' : times.start, end: allDay ? '' : times.end })
  const overnight = endCheck.ok && endCheck.overnight ? endCheck.endDateISO : ''

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const title = draft.title.trim()
    if (!title) return setError(t('event.titleRequired'))
    const { start, end } = allDay ? { start: '', end: '' } : times
    // 結束日期＋時間要晚於開始；同一天結束時間較早（例如 22:30～02:00）視為跨過午夜，結束日自動是隔天
    const ended = checkEnd({ dateISO: draft.dateISO, endDateISO: draft.endDateISO ?? '', start, end })
    if (!ended.ok) return setError(t('event.endBeforeStart'))
    const data = { ...draft, title, start, end, endDateISO: ended.endDateISO, note: draft.note.trim() }
    if (!space) {
      if (event) updateEvent(event.id, data)
      else addEvent(data)
      return onClose()
    }
    const vis = sharedDraft.visibility
    if (vis.mode === 'selected_members' && vis.allowedUserIds.length === 0) return setError(t('sharing.allowedRequired'))
    // 只留這個空間現有成員，避免殘留已移除成員的 id
    const members = new Set(space.members.map((m) => m.userId))
    const visibility = { ...vis, allowedUserIds: vis.allowedUserIds.filter((id) => members.has(id)), hiddenUserIds: vis.hiddenUserIds.filter((id) => members.has(id)), busyLabel: vis.busyLabel.trim() }
    const content = { ...data, kind: sharedDraft.kind, location: sharedDraft.location.trim(), details: cleanDetails(sharedDraft.kind, sharedDraft.details) }
    try {
      if (shared) updateItem(shared.id, shared.canManageVisibility ? { ...content, visibility } : content)
      else addItem(space.id, { ...content, visibility })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const pickTarget = (id: string) => {
    setTarget(id)
    const next = allSpaces.find((s) => s.id === id)
    // 換空間時，類型預設成該空間建議的第一個
    if (next) setSharedDraft((d) => ({ ...d, kind: orderedKinds(next.kind)[0]!, visibility: defaultVisibility() }))
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={event ? t('event.editTitle') : t('event.newTitle')}>
      <form onSubmit={submit} className="grid gap-4">
        <div className="flex items-center gap-2.5 rounded-(--radius-control) border-l-4 px-4 py-3 text-sm font-bold" style={{ background: draft.bgColor, color: draft.titleColor, borderLeftColor: draft.titleColor }}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ background: ICON_BG[eventIconOf(draft)] }}>
            <EventIconArt icon={eventIconOf(draft)} size={20} />
          </span>
          {draft.title.trim() || t('event.preview')}
        </div>
        {!editing && writable.length > 0 && (
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            {t('sharing.belongsTo')}
            <select
              value={target}
              onChange={(e) => pickTarget(e.target.value)}
              className="rounded-(--radius-control) border border-line bg-oat px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-sage"
            >
              <option value="personal">{t('sharing.myCalendar')}</option>
              {writable.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}（{t(`sharing.spaceKind.${s.kind}`)}）
                </option>
              ))}
            </select>
          </label>
        )}
        {editing && space && <p className="-mt-1 text-xs font-semibold text-sage-dark">{t('sharing.inSpace', { name: space.name })}</p>}
        <Field label={t('event.title')} placeholder={t('event.titlePlaceholder')} value={draft.title} onChange={(e) => set({ title: e.target.value })} autoFocus />
        <div className="grid gap-3 min-[30rem]:grid-cols-2">
          {/* 開始日期改了，結束日期跟著平移（保持天數）；沒設結束日期時就跟開始日期同一天 */}
          <Field
            label={t('event.date')}
            type="date"
            value={draft.dateISO}
            onChange={(e) => set({ dateISO: e.target.value, endDateISO: shiftEndDate(draft.dateISO, e.target.value, draft.endDateISO ?? '') })}
          />
          <Field
            label={t('event.endDate')}
            type="date"
            min={draft.dateISO}
            value={draft.endDateISO || draft.dateISO}
            onChange={(e) => set({ endDateISO: e.target.value && e.target.value !== draft.dateISO ? e.target.value : '' })}
          />
        </div>
        <div className="grid gap-2">
          <AllDayToggle checked={allDay} onChange={setAllDay} />
          {!allDay && (
            <div className="grid gap-3 min-[30rem]:grid-cols-2">
              <TimeField label={t('event.start')} value={times.start} onChange={(start) => setTimes((x) => ({ ...x, start }))} />
              <TimeField label={t('event.end')} value={times.end} onChange={(end) => setTimes((x) => ({ ...x, end }))} />
            </div>
          )}
          {overnight && (
            <p data-overnight className="text-xs text-sage-dark">
              {t('event.overnightHint', { date: overnight })}
            </p>
          )}
        </div>
        {error && <p className="-mt-2 text-xs text-[#c2583d]">{error}</p>}
        <BusyOverlapNotice target={target} dateISO={draft.dateISO} start={allDay ? '' : times.start} end={allDay ? '' : times.end} />
        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('event.color')}
          <ColorSwatches label={t('event.color')} value={draft.bgColor} onChange={(c) => set({ bgColor: c.bg })} />
        </div>
        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('event.textColor')}
          <TextColorSwatches label={t('event.textColor')} value={draft.titleColor} onChange={(c) => set({ titleColor: c })} />
        </div>
        <div className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('event.icon')}
          <div role="radiogroup" aria-label={t('event.icon')} className="flex flex-wrap gap-2">
            <button
              type="button"
              role="radio"
              aria-checked={!draft.icon}
              onClick={() => set({ icon: undefined })}
              className={`h-9 rounded-full border px-3 text-xs font-bold ${!draft.icon ? 'border-sage bg-sage-light text-sage-dark ring-2 ring-sage/30' : 'border-line bg-oat text-muted'}`}
            >
              {t('event.iconAuto')}
            </button>
            {EVENT_ICON_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={draft.icon === k}
                aria-label={t(`icons.${k}`)}
                title={t(`icons.${k}`)}
                onClick={() => set({ icon: k })}
                className={`grid size-9 place-items-center rounded-full border ${draft.icon === k ? 'border-sage ring-2 ring-sage/30' : 'border-line'}`}
                style={{ background: ICON_BG[k] }}
              >
                <EventIconArt icon={k} size={22} />
              </button>
            ))}
          </div>
        </div>
        <Field label={t('event.note')} placeholder={t('event.notePlaceholder')} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
        {space && <SharingFields space={space} selfId={selfId} value={sharedDraft} onChange={setSharedDraft} locked={!!shared && !shared.canManageVisibility} />}
        <div className="mt-2 flex gap-2">
          {editing && (
            <Button
              variant="danger"
              onClick={() => {
                // 移到「最近刪除」，提示裡可以直接復原（30 天內也能從「最近刪除」還原）
                if (shared) removeItem(shared.id)
                else if (event) removeEvent(event.id)
                const sharedId = shared?.id
                const original = event
                showToast({
                  message: t('trash.moved'),
                  action: {
                    label: t('trash.undo'),
                    onClick: () => {
                      if (sharedId) useSpacesStore.getState().restoreItem(sharedId)
                      else if (original) useAppStore.getState().restoreEvents([original])
                    },
                  },
                })
                onClose()
              }}
            >
              {t('common.delete')}
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit">{t('common.save')}</Button>
        </div>
      </form>
    </Dialog>
  )
}

/**
 * 重疊提醒：要放進的行事曆（我的行事曆或某個空間）在這段時間已經有忙碌區塊時，列出來提醒。
 * 不擋儲存，只是避免撞期；自己投射過去的區塊會寫出來源，其他成員的區塊寫建立者。
 */
function BusyOverlapNotice({ target, dateISO, start, end }: { target: string; dateISO: string; start: string; end: string }) {
  const { t } = useTranslation()
  const conflicts = useBusyConflicts(target, dateISO, start, end)
  if (conflicts.length === 0) return null
  const sourceOf = (c: SharedEntry) => {
    if (c.projectedFrom) return t('sharing.rules.fromSource', { name: c.projectedFrom.id === PERSONAL_CALENDAR_ID || !c.projectedFrom.name ? t('sharing.myCalendar') : c.projectedFrom.name })
    return c.creatorName
  }
  return (
    <div role="status" data-busy-overlap className="-mt-1 rounded-(--radius-control) border border-[#f0dfc0] bg-[#fff8ec] px-3.5 py-2.5 text-xs leading-relaxed text-[#8a5a1c]">
      <p className="font-bold">{t('sharing.overlap.title')}</p>
      <ul className="mt-1 grid gap-0.5">
        {conflicts.map((c) => {
          const label = c.busyDisplay === 'time_only' ? '' : c.busyLabel || t('sharing.busy')
          const source = sourceOf(c)
          return (
            <li key={c.id}>
              ・{formatTimeRange(c.start, c.end) || t('event.allDay')}
              {label && ` ${label}`}
              {source && `（${source}）`}
            </li>
          )
        })}
      </ul>
      <p className="mt-1 text-[#a27a45]">{t('sharing.overlap.hint')}</p>
    </div>
  )
}
