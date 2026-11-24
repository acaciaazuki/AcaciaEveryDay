import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_SLEEP, DEFAULT_WAKE, hours, rhythmLength, rhythmTimes } from '../core/today'
import { formatTime } from '../core/time'
import { useAppStore } from '../store/useAppStore'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { TimeField } from './TimeField'

/** 調整今天頁「節奏」的起床與就寢時間（存在設定裡，跟著備份與同步） */
export function RhythmDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const setRhythm = useAppStore((s) => s.setRhythm)
  const [draft, setDraft] = useState(() => rhythmTimes(settings))
  const [error, setError] = useState('')

  const same = draft.wake === draft.sleep
  const overnight = !same && draft.sleep < draft.wake
  const isDefault = draft.wake === DEFAULT_WAKE && draft.sleep === DEFAULT_SLEEP

  const set = (patch: Partial<typeof draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setError('')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.wake || !draft.sleep) return setError(t('rhythm.required'))
    if (same) return setError(t('rhythm.same'))
    // 跟預設一樣就不存，之後預設值若調整也能跟著走
    setRhythm(isDefault ? null : draft)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('rhythm.title')}>
      <form onSubmit={submit} className="grid gap-4">
        <p className="text-[length:calc(13px*var(--fs))] text-muted">{t('rhythm.intro')}</p>
        <div className="grid gap-3 min-[30rem]:grid-cols-2">
          <TimeField label={t('rhythm.wake')} value={draft.wake} onChange={(wake) => set({ wake })} />
          <TimeField label={t('rhythm.sleep')} value={draft.sleep} onChange={(sleep) => set({ sleep })} />
        </div>
        {error ? (
          <p role="alert" className="-mt-2 text-xs text-[#c2583d]">
            {error}
          </p>
        ) : (
          draft.wake &&
          draft.sleep &&
          !same && (
            <p className="-mt-2 text-xs text-muted">
              {t('rhythm.length', { h: hours(rhythmLength(draft.wake, draft.sleep)) })}
              {overnight && ` · ${t('rhythm.overnight')}`}
            </p>
          )
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="ghost" disabled={isDefault} onClick={() => set({ wake: DEFAULT_WAKE, sleep: DEFAULT_SLEEP })}>
            {t('rhythm.reset', { range: `${formatTime(DEFAULT_WAKE)}–${formatTime(DEFAULT_SLEEP)}` })}
          </Button>
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit">{t('common.save')}</Button>
        </div>
      </form>
    </Dialog>
  )
}
