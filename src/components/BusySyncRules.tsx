import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { needsShareConfirm, shareAudience } from '../core/busyConsent'
import { PERSONAL_CALENDAR_ID, roleOf, type BusyDisplay, type BusyProjectionRule, type Space } from '../core/sharing'
import { useSpacesStore } from '../store/useSpacesStore'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Field } from './Field'

const select = 'w-full rounded-(--radius-control) border border-line bg-oat px-3 py-2 text-sm font-normal text-ink outline-none focus:border-sage'
const legend = 'mb-2 text-xs font-semibold text-muted'
const option = 'flex items-center gap-2 text-[length:calc(13px*var(--fs))]'

/** 我所在的空間（還沒刪除） */
function useMemberSpaces() {
  const selfId = useSpacesStore((s) => s.selfId)
  const spaces = useSpacesStore((s) => s.data.spaces)
  return spaces.filter((s) => roleOf(s, selfId))
}

/** 行事曆名稱：「我的行事曆」或空間名稱 */
function useCalendarName(spaces: readonly Space[]) {
  const { t } = useTranslation()
  return (id: string) => (id === PERSONAL_CALENDAR_ID ? t('sharing.myCalendar') : (spaces.find((s) => s.id === id)?.name ?? '—'))
}

/**
 * 設定頁「共享空間」裡的「忙碌時段同步」：規則清單（啟用開關、編輯、刪除）與新增按鈕。
 * 每條規則一張小卡：「我的行事曆 → 全部行事曆」、下一行是顯示方式。
 */
export function BusySyncRules({ readOnly }: { readOnly: boolean }) {
  const { t } = useTranslation()
  const selfId = useSpacesStore((s) => s.selfId)
  const rules = useSpacesStore((s) => s.data.busyProjectionRules).filter((r) => r.userId === selfId && r.deletedAt === null)
  const updateRule = useSpacesStore((s) => s.updateRule)
  const removeRule = useSpacesStore((s) => s.removeRule)
  const spaces = useMemberSpaces()
  const nameOf = useCalendarName(spaces)
  const [editing, setEditing] = useState<BusyProjectionRule | 'new' | null>(null)
  if (spaces.length === 0) return null

  return (
    <section aria-labelledby="busy-sync-title" className="mt-5 border-t border-line pt-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 id="busy-sync-title" className="text-sm font-bold">
          {t('sharing.rules.title')}
        </h3>
        {!readOnly && (
          <Button variant="ghost" onClick={() => setEditing('new')}>
            {t('sharing.rules.add')}
          </Button>
        )}
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted">{t('sharing.rules.help')}</p>
      {rules.length === 0 ? (
        <p className="text-xs text-muted">{t('sharing.rules.empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {rules.map((r) => (
            <li key={r.id} data-rule={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-oat/60 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[length:calc(13px*var(--fs))] font-semibold">
                  {nameOf(r.sourceId)} → {r.targetMode === 'all' ? t('sharing.allCalendars') : r.targetIds.map(nameOf).join('、')}
                </p>
                <p className="mt-0.5 text-[length:calc(12px*var(--fs))] text-muted">
                  {t('sharing.rules.display')}：{r.display === 'time_only' ? t('sharing.rules.displayTimeOnly') : `${t('sharing.busy')}「${r.label || t('sharing.busy')}」`}
                </p>
              </div>
              {!readOnly && (
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 text-muted">
                    <input type="checkbox" checked={r.enabled} onChange={(e) => updateRule(r.id, { enabled: e.target.checked })} className="accent-sage" />
                    {t('sharing.rules.enabled')}
                  </label>
                  <button type="button" className="font-semibold text-sage-dark hover:underline" onClick={() => setEditing(r)}>
                    {t('sharing.rules.edit')}
                  </button>
                  <button type="button" className="text-muted hover:text-[#c2583d]" onClick={() => removeRule(r.id)}>
                    {t('sharing.rules.remove')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && <BusyRuleDialog rule={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

/**
 * 新增／編輯一條忙碌時段同步規則。
 * - 來源：我的行事曆、我所在的各空間
 * - 同步到：全部行事曆，或勾選（來源本身不會出現；來源是空間時可以勾「我的行事曆」）
 * - 顯示方式：忙碌（自訂文字）／只顯示時間區間
 * - 進階：整天行程、私人行程（只有空間來源有隱私等級）
 * - 預覽：其他成員實際會看到的樣子
 * presetTarget：從行事曆的空間分頁打開時，預先勾選那個空間
 */
export function BusyRuleDialog({ rule, presetTarget, onClose }: { rule?: BusyProjectionRule; presetTarget?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const addRule = useSpacesStore((s) => s.addRule)
  const updateRule = useSpacesStore((s) => s.updateRule)
  const spaces = useMemberSpaces()
  const nameOf = useCalendarName(spaces)
  const [sourceId, setSourceId] = useState(rule?.sourceId ?? (presetTarget === PERSONAL_CALENDAR_ID ? (spaces[0]?.id ?? PERSONAL_CALENDAR_ID) : PERSONAL_CALENDAR_ID))
  const [targetMode, setTargetMode] = useState<'all' | 'selected'>(rule?.targetMode ?? (presetTarget ? 'selected' : 'all'))
  const [targetIds, setTargetIds] = useState<string[]>(rule?.targetIds ?? (presetTarget ? [presetTarget] : []))
  const [display, setDisplay] = useState<BusyDisplay>(rule?.display ?? 'busy')
  const [label, setLabel] = useState(rule?.label ?? '')
  const [includeAllDay, setIncludeAllDay] = useState(rule?.includeAllDay ?? false)
  const [includePrivate, setIncludePrivate] = useState(rule?.includePrivate ?? false)
  const [error, setError] = useState('')
  // 二次確認：要讓其他成員看到更多時段時，先列出對象與注意事項，再按「確認同步」才儲存
  const [confirming, setConfirming] = useState(false)
  const selfId = useSpacesStore((s) => s.selfId)

  const candidates = [...(sourceId === PERSONAL_CALENDAR_ID ? [] : [PERSONAL_CALENDAR_ID]), ...spaces.map((s) => s.id).filter((id) => id !== sourceId)]
  const chosen = targetMode === 'all' ? candidates : targetIds.filter((id) => candidates.includes(id))
  const sample = display === 'time_only' ? '14:00–16:00' : `14:00–16:00 ${label.trim() || t('sharing.busy')}`
  const previewSpace = chosen.find((id) => id !== PERSONAL_CALENDAR_ID)
  const preview = previewSpace ? t('sharing.rules.preview', { space: nameOf(previewSpace), text: sample }) : chosen.length > 0 ? t('sharing.rules.previewSelf', { text: sample }) : ''

  const toggle = (id: string, on: boolean) => setTargetIds((ids) => (on ? [...ids.filter((x) => x !== id), id] : ids.filter((x) => x !== id)))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (targetMode === 'selected' && chosen.length === 0) return setError(t('sharing.rules.needTarget'))
    const input = {
      sourceId,
      targetMode,
      targetIds: targetMode === 'all' ? [] : chosen,
      display,
      label: display === 'busy' ? label.trim() : '',
      includeAllDay,
      includePrivate: sourceId === PERSONAL_CALENDAR_ID ? false : includePrivate,
    }
    if (!confirming && needsShareConfirm(rule, input, chosen.filter((id) => id !== PERSONAL_CALENDAR_ID))) return setConfirming(true)
    try {
      if (rule) updateRule(rule.id, input)
      else addRule(input)
      onClose()
    } catch (err) {
      setConfirming(false)
      setError(err instanceof Error ? err.message : String(err))
    }
  }
  const audience = shareAudience(spaces, chosen, selfId)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={rule ? t('sharing.rules.editTitle') : t('sharing.rules.addTitle')}>
      <form onSubmit={submit} className="grid gap-5">
        {confirming ? (
          <div data-rule-confirm className="grid gap-3 text-[length:calc(13px*var(--fs))]">
            <p className="font-semibold">{t('sharing.rules.confirmIntro')}</p>
            <ul className="grid gap-1 rounded-(--radius-control) bg-sage-light px-3 py-2 text-sage-dark">
              {audience.map((a) => (
                <li key={a.id}>{t('sharing.rules.confirmSpace', { name: a.name, count: a.others })}</li>
              ))}
            </ul>
            <ul className="grid list-disc gap-1 pl-5 text-muted">
              <li>{display === 'time_only' ? t('sharing.rules.confirmTimeOnly') : t('sharing.rules.confirmBusy', { text: label.trim() || t('sharing.busy') })}</li>
              {targetMode === 'all' && <li>{t('sharing.rules.confirmAll')}</li>}
              {includeAllDay && <li>{t('sharing.rules.confirmAllDay')}</li>}
              {includePrivate && sourceId !== PERSONAL_CALENDAR_ID && <li className="font-semibold text-[#c2583d]">{t('sharing.rules.confirmPrivate')}</li>}
              <li>{t('sharing.rules.confirmRevoke')}</li>
            </ul>
          </div>
        ) : (
          <>
        <label className="grid gap-1.5 text-xs font-semibold text-muted">
          {t('sharing.rules.source')}
          <select
            value={sourceId}
            // 編輯時不能換來源：換來源等於另一條規則，舊的區塊 id 會對不上
            disabled={!!rule}
            onChange={(e) => {
              setSourceId(e.target.value)
              setTargetIds((ids) => ids.filter((id) => id !== e.target.value))
            }}
            className={select}
          >
            <option value={PERSONAL_CALENDAR_ID}>{t('sharing.myCalendar')}</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className={legend}>{t('sharing.rules.targets')}</legend>
          <div className="grid gap-2">
            <label className={option}>
              <input type="radio" name="target-mode" checked={targetMode === 'all'} onChange={() => setTargetMode('all')} className="accent-sage" />
              {t('sharing.rules.targetAll')}
            </label>
            <label className={option}>
              <input type="radio" name="target-mode" checked={targetMode === 'selected'} onChange={() => setTargetMode('selected')} className="accent-sage" />
              {t('sharing.rules.targetSelected')}
            </label>
            {targetMode === 'selected' && (
              <div role="group" aria-label={t('sharing.rules.targetSelected')} className="ml-6 grid gap-1.5">
                {candidates.length === 0 ? (
                  <p className="text-xs text-muted">{t('sharing.rules.noTargets')}</p>
                ) : (
                  candidates.map((id) => (
                    <label key={id} className={option}>
                      <input type="checkbox" checked={targetIds.includes(id)} onChange={(e) => toggle(id, e.target.checked)} className="accent-sage" />
                      {nameOf(id)}
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend className={legend}>{t('sharing.rules.display')}</legend>
          <div className="grid gap-2">
            <label className={option}>
              <input type="radio" name="display" checked={display === 'busy'} onChange={() => setDisplay('busy')} className="accent-sage" />
              {t('sharing.rules.displayBusy')}
            </label>
            {display === 'busy' && (
              <div className="ml-6">
                <Field label={t('sharing.busyLabel')} placeholder={t('sharing.busyLabelPlaceholder')} maxLength={20} value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
            )}
            <label className={option}>
              <input type="radio" name="display" checked={display === 'time_only'} onChange={() => setDisplay('time_only')} className="accent-sage" />
              {t('sharing.rules.displayTimeOnly')}
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend className={legend}>{t('sharing.rules.advanced')}</legend>
          <div className="grid gap-2">
            <label className={option}>
              <input type="checkbox" checked={includeAllDay} onChange={(e) => setIncludeAllDay(e.target.checked)} className="accent-sage" />
              {t('sharing.rules.includeAllDay')}
            </label>
            {/* 個人行程沒有隱私等級，只有空間來源才有這個選項 */}
            {sourceId !== PERSONAL_CALENDAR_ID && (
              <label className={option}>
                <input type="checkbox" checked={includePrivate} onChange={(e) => setIncludePrivate(e.target.checked)} className="accent-sage" />
                {t('sharing.rules.includePrivate')}
              </label>
            )}
          </div>
        </fieldset>

        {preview && (
          <p data-rule-preview className="rounded-(--radius-control) bg-sage-light px-3 py-2 text-xs text-sage-dark">
            {preview}
          </p>
        )}
          </>
        )}
        {error && (
          <p role="alert" className="text-xs text-[#c2583d]">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          {confirming ? (
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t('sharing.rules.confirmBack')}
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          )}
          <Button type="submit">{confirming ? t('sharing.rules.confirmOk') : t('sharing.rules.save')}</Button>
        </div>
      </form>
    </Dialog>
  )
}
