import { useTranslation } from 'react-i18next'
import { DETAIL_MAX, detailFieldsOf } from '../core/itemDetails'
import { MASKABLE_FIELDS, orderedKinds, VISIBILITY_MODES, type ItemKind, type Space, type Visibility } from '../core/sharing'
import { Field } from './Field'

export interface SharedDraft {
  kind: ItemKind
  location: string
  /** 依類型填寫的細節；存檔時由 cleanDetails 只留這個類型的欄位 */
  details: Record<string, string>
  visibility: Visibility
}

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1.5 text-xs font-bold transition ${on ? 'border-sage bg-sage-light text-sage-dark ring-2 ring-sage/30' : 'border-line bg-oat text-muted hover:text-ink'}`

/** 行程對話框裡「共享空間」專用的欄位：類型、地點、誰看得到 */
export function SharingFields({ space, selfId, value, onChange, locked }: { space: Space; selfId: string; value: SharedDraft; onChange: (v: SharedDraft) => void; locked: boolean }) {
  const { t } = useTranslation()
  const v = value.visibility
  const setVis = (patch: Partial<Visibility>) => onChange({ ...value, visibility: { ...v, ...patch } })
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  const others = space.members.filter((m) => m.userId !== selfId)
  const memberName = (m: (typeof others)[number]) => m.displayName || t('sharing.unnamed')

  return (
    <div className="grid gap-4 rounded-(--radius-control) border border-line bg-oat/60 p-3">
      <label className="grid gap-1.5 text-xs font-semibold text-muted">
        {t('sharing.kind')}
        <select
          value={value.kind}
          onChange={(e) => onChange({ ...value, kind: e.target.value as ItemKind })}
          className="rounded-(--radius-control) border border-line bg-paper px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-sage"
        >
          {orderedKinds(space.kind).map((k) => (
            <option key={k} value={k}>
              {t(`sharing.itemKind.${k}`)}
            </option>
          ))}
        </select>
      </label>
      <Field label={t('sharing.location')} value={value.location} onChange={(e) => onChange({ ...value, location: e.target.value })} />
      {detailFieldsOf(value.kind).length > 0 && (
        <div role="group" aria-label={t('sharing.detailsTitle')} className="grid gap-3 min-[30rem]:grid-cols-2">
          {detailFieldsOf(value.kind).map((key) => (
            <Field
              key={key}
              label={t(`sharing.detail.${key}`)}
              placeholder={t(`sharing.detailPlaceholder.${key}`)}
              type={key === 'meetingLink' ? 'url' : 'text'}
              inputMode={key === 'meetingLink' ? 'url' : undefined}
              maxLength={DETAIL_MAX}
              value={value.details[key] ?? ''}
              onChange={(e) => onChange({ ...value, details: { ...value.details, [key]: e.target.value } })}
            />
          ))}
        </div>
      )}

      <fieldset disabled={locked} className="grid gap-3">
        <legend className="mb-1.5 text-xs font-semibold text-muted">{t('sharing.privacy')}</legend>
        {locked && <p className="-mt-1 text-xs text-muted">{t('sharing.privacyLocked')}</p>}
        <div role="radiogroup" aria-label={t('sharing.privacy')} className="flex flex-wrap gap-2">
          {VISIBILITY_MODES.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={v.mode === m} onClick={() => setVis({ mode: m })} className={chip(v.mode === m)}>
              {t(`sharing.visibility.${m}`)}
            </button>
          ))}
        </div>

        {v.mode === 'busy_only' && (
          <Field label={t('sharing.busyLabel')} placeholder={t('sharing.busyLabelPlaceholder')} maxLength={20} value={v.busyLabel} onChange={(e) => setVis({ busyLabel: e.target.value })} />
        )}

        {v.mode !== 'private' && others.length === 0 && <p className="text-xs text-muted">{t('sharing.noMembers')}</p>}

        {v.mode === 'selected_members' && others.length > 0 && (
          <div role="group" aria-label={t('sharing.allowed')} className="grid gap-1.5">
            <span className="text-xs font-semibold text-muted">{t('sharing.allowed')}</span>
            <div className="flex flex-wrap gap-2">
              {others.map((m) => (
                <label key={m.userId} className={chip(v.allowedUserIds.includes(m.userId))}>
                  <input type="checkbox" className="sr-only" checked={v.allowedUserIds.includes(m.userId)} onChange={() => setVis({ allowedUserIds: toggle(v.allowedUserIds, m.userId) })} />
                  {memberName(m)}
                </label>
              ))}
            </div>
          </div>
        )}

        {v.mode !== 'private' && others.length > 0 && (
          <div role="group" aria-label={t('sharing.hiddenFrom')} className="grid gap-1.5">
            <span className="text-xs font-semibold text-muted">{t('sharing.hiddenFrom')}</span>
            <div className="flex flex-wrap gap-2">
              {others.map((m) => (
                <label key={m.userId} className={chip(v.hiddenUserIds.includes(m.userId))}>
                  <input type="checkbox" className="sr-only" checked={v.hiddenUserIds.includes(m.userId)} onChange={() => setVis({ hiddenUserIds: toggle(v.hiddenUserIds, m.userId) })} />
                  {memberName(m)}
                </label>
              ))}
            </div>
          </div>
        )}

        {(v.mode === 'group_full' || v.mode === 'selected_members') && (
          <div role="group" aria-label={t('sharing.masked')} className="grid gap-1.5">
            <span className="text-xs font-semibold text-muted">{t('sharing.masked')}</span>
            <div className="flex flex-wrap gap-2">
              {MASKABLE_FIELDS.map((f) => (
                <label key={f} className={chip(v.maskedFields.includes(f))}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={v.maskedFields.includes(f)}
                    onChange={() => setVis({ maskedFields: v.maskedFields.includes(f) ? v.maskedFields.filter((x) => x !== f) : [...v.maskedFields, f] })}
                  />
                  {t(`sharing.maskField.${f}`)}
                </label>
              ))}
            </div>
          </div>
        )}
      </fieldset>
    </div>
  )
}
