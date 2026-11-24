import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { canManageSpace, MEMBER_ROLES, PERSONAL_CALENDAR_ID, roleOf, SPACE_KINDS, type BusyProjectionRule, type MemberRole, type Space, type SpaceKind } from '../core/sharing'
import { useSpacesStore } from '../store/useSpacesStore'
import { Button } from './Button'
import { Field } from './Field'
import { SpacesSnapshots, SpacesSyncPanel } from './SpacesSyncPanel'

const select = 'rounded-(--radius-control) border border-line bg-oat px-3 py-2 text-sm font-normal text-ink outline-none focus:border-sage'

/** 設定頁「共享空間」：新增空間、模擬成員與角色、跨空間忙閒投射規則 */
export function SpacesPanel() {
  const { t } = useTranslation()
  const selfId = useSpacesStore((s) => s.selfId)
  const viewerId = useSpacesStore((s) => s.viewerId)
  const allSpaces = useSpacesStore((s) => s.data.spaces)
  const createSpace = useSpacesStore((s) => s.createSpace)
  const spaces = allSpaces.filter((s) => roleOf(s, selfId))
  const [name, setName] = useState('')
  const [kind, setKind] = useState<SpaceKind>('family')
  const [error, setError] = useState('')
  const previewing = viewerId !== selfId

  const run = (fn: () => void) => {
    try {
      fn()
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError(t('sharing.panel.nameRequired'))
    run(() => {
      createSpace({ name: name.trim(), kind })
      setName('')
    })
  }

  return (
    <section className="rounded-(--radius-card) bg-paper p-6 shadow-card">
      <h2 className="mb-1 font-bold">{t('sharing.panel.title')}</h2>
      <p className="mb-4 text-xs leading-relaxed text-muted">{t('sharing.panel.help')}</p>
      {previewing && <p className="mb-3 text-xs text-sage-dark">{t('sharing.readOnlyPreview')}</p>}
      <SpacesSyncPanel readOnly={previewing} />

      <form onSubmit={submit} className="mb-5 grid gap-3 min-[30rem]:grid-cols-[1fr_auto_auto] min-[30rem]:items-end">
        <Field label={t('sharing.spaceName')} placeholder={t('sharing.panel.namePlaceholder')} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} disabled={previewing} />
        <label className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('sharing.panel.kind')}
          <select value={kind} onChange={(e) => setKind(e.target.value as SpaceKind)} className={select} disabled={previewing}>
            {SPACE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`sharing.spaceKind.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={previewing}>
          {t('sharing.newSpace')}
        </Button>
      </form>
      {error && (
        <p role="alert" className="-mt-3 mb-3 text-xs text-[#c2583d]">
          {error}
        </p>
      )}

      {spaces.length === 0 ? (
        <p className="text-xs text-muted">{t('sharing.panel.empty')}</p>
      ) : (
        <ul className="grid gap-3">
          {spaces.map((s) => (
            <li key={s.id}>
              <SpaceCard space={s} selfId={selfId} readOnly={previewing} onError={setError} />
            </li>
          ))}
        </ul>
      )}

      {spaces.length >= 2 && <RulesEditor spaces={spaces} readOnly={previewing} onError={setError} />}
      <SpacesSnapshots readOnly={previewing} />
    </section>
  )
}

function SpaceCard({ space, selfId, readOnly, onError }: { space: Space; selfId: string; readOnly: boolean; onError: (m: string) => void }) {
  const { t } = useTranslation()
  const addMember = useSpacesStore((s) => s.addMember)
  const updateMember = useSpacesStore((s) => s.updateMember)
  const removeMember = useSpacesStore((s) => s.removeMember)
  const deleteSpace = useSpacesStore((s) => s.deleteSpace)
  const [memberName, setMemberName] = useState('')
  const [role, setRole] = useState<MemberRole>('viewer')
  const manage = !readOnly && canManageSpace(space, selfId)
  const run = (fn: () => void) => {
    try {
      fn()
      onError('')
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="rounded-(--radius-control) border border-line p-4" aria-label={space.name} role="group">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <strong>{space.name}</strong>
        <span className="rounded-full bg-sage-light px-2 py-0.5 text-[length:calc(11px*var(--fs))] font-bold text-sage-dark">{t(`sharing.spaceKind.${space.kind}`)}</span>
        {manage && (
          <button
            type="button"
            className="ml-auto text-xs font-semibold text-[#c2583d]"
            onClick={() => window.confirm(t('sharing.panel.deleteConfirm', { name: space.name })) && run(() => deleteSpace(space.id))}
          >
            {t('sharing.panel.deleteSpace')}
          </button>
        )}
      </div>
      <ul className="mb-3 grid gap-1.5">
        {space.members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center gap-2 text-[length:calc(13px*var(--fs))]">
            <span className="min-w-0 flex-1 truncate">{m.userId === selfId ? t('sharing.me') : m.displayName || t('sharing.unnamed')}</span>
            {manage && m.userId !== selfId ? (
              <>
                <select
                  aria-label={t('sharing.panel.roleOf', { name: m.displayName })}
                  value={m.role}
                  onChange={(e) => run(() => updateMember(space.id, m.userId, { role: e.target.value as MemberRole }))}
                  className={`${select} py-1 text-xs`}
                >
                  {MEMBER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`sharing.role.${r}`)}
                    </option>
                  ))}
                </select>
                <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => run(() => removeMember(space.id, m.userId))}>
                  {t('sharing.panel.remove')}
                </button>
              </>
            ) : (
              <span className="text-xs text-muted">{t(`sharing.role.${m.role}`)}</span>
            )}
          </li>
        ))}
      </ul>
      {manage && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!memberName.trim()) return onError(t('sharing.panel.memberRequired'))
            run(() => {
              addMember(space.id, { displayName: memberName, role })
              setMemberName('')
            })
          }}
        >
          <div className="min-w-32 flex-1">
            <Field label={t('sharing.panel.memberName')} placeholder={t('sharing.panel.memberPlaceholder')} value={memberName} maxLength={40} onChange={(e) => setMemberName(e.target.value)} />
          </div>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            {t('sharing.panel.memberRole')}
            <select value={role} onChange={(e) => setRole(e.target.value as MemberRole)} className={select}>
              {MEMBER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`sharing.role.${r}`)}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="ghost">
            {t('sharing.panel.addMember')}
          </Button>
        </form>
      )}
    </div>
  )
}

function RulesEditor({ spaces, readOnly, onError }: { spaces: Space[]; readOnly: boolean; onError: (m: string) => void }) {
  const { t } = useTranslation()
  const selfId = useSpacesStore((s) => s.selfId)
  const rules = useSpacesStore((s) => s.data.busyProjectionRules).filter((r) => r.userId === selfId && r.deletedAt === null)
  const addRule = useSpacesStore((s) => s.addRule)
  const updateRule = useSpacesStore((s) => s.updateRule)
  const removeRule = useSpacesStore((s) => s.removeRule)
  const [from, setFrom] = useState(spaces[0]!.id)
  const [to, setTo] = useState(spaces[1]!.id)
  const [label, setLabel] = useState('')
  const nameOf = (id: string) => (id === PERSONAL_CALENDAR_ID ? t('sharing.myCalendar') : (spaces.find((s) => s.id === id)?.name ?? '—'))
  const targetsOf = (r: BusyProjectionRule) => (r.targetMode === 'all' ? t('sharing.allCalendars') : r.targetIds.map(nameOf).join('、'))

  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className="mb-1 text-sm font-bold">{t('sharing.projection')}</h3>
      <p className="mb-3 text-xs leading-relaxed text-muted">{t('sharing.panel.rulesHelp')}</p>
      {rules.length > 0 && (
        <ul className="mb-3 grid gap-1.5">
          {rules.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 text-[length:calc(13px*var(--fs))]">
              <span className="min-w-0 flex-1">
                {r.display === 'time_only'
                  ? t('sharing.panel.ruleTimeOnly', { from: nameOf(r.sourceId), to: targetsOf(r) })
                  : t('sharing.panel.ruleText', { from: nameOf(r.sourceId), to: targetsOf(r), label: r.label || t('sharing.busy') })}
              </span>
              {!readOnly && (
                <>
                  <label className="flex items-center gap-1 text-xs text-muted">
                    <input type="checkbox" checked={r.enabled} onChange={(e) => updateRule(r.id, { enabled: e.target.checked })} />
                    {t('sharing.panel.enabled')}
                  </label>
                  <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => removeRule(r.id)}>
                    {t('sharing.panel.remove')}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (from === to) return onError(t('sharing.panel.sameSpace'))
            try {
              // 目前的編輯器只建立「空間 → 單一空間」、整天行程照投射的規則（跟舊版一致，舊版 App 也讀得懂）；完整設定介面在第 3 階段
              addRule({ sourceId: from, targetMode: 'selected', targetIds: [to], label: label.trim(), includeAllDay: true })
              setLabel('')
              onError('')
            } catch (err) {
              onError(err instanceof Error ? err.message : String(err))
            }
          }}
        >
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            {t('sharing.panel.from')}
            <select value={from} onChange={(e) => setFrom(e.target.value)} className={select}>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            {t('sharing.panel.to')}
            <select value={to} onChange={(e) => setTo(e.target.value)} className={select}>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="min-w-28 flex-1">
            <Field label={t('sharing.busyLabel')} placeholder={t('sharing.busyLabelPlaceholder')} maxLength={20} value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <Button type="submit" variant="ghost">
            {t('sharing.panel.addRule')}
          </Button>
        </form>
      )}
    </div>
  )
}
