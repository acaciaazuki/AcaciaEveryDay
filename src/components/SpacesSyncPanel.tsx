import { useEffect, useState } from 'react'
import { isNativeApp } from '../adapters/kv'
import { useTranslation } from 'react-i18next'
import { formatStamp, TIME_24 } from '../core/time'
import { useSpacesBackupStore } from '../store/useSpacesBackupStore'
import { useSpacesStore } from '../store/useSpacesStore'
import { useSpacesSyncStore } from '../store/useSpacesSyncStore'
import { useSyncStore } from '../store/useSyncStore'
import { Button } from './Button'
import { Dialog } from './Dialog'

/** 設定頁「共享空間」裡的雲端同步：開關、狀態、立即同步、關閉時選擇是否刪除雲端檔案 */
export function SpacesSyncPanel({ readOnly }: { readOnly: boolean }) {
  const { t, i18n } = useTranslation()
  const on = useSpacesStore((s) => s.cloudSync)
  const signedIn = useSyncStore((s) => s.token !== null)
  const { state, lastSyncedAt, error, syncNow, enable, disable } = useSpacesSyncStore()
  const [closing, setClosing] = useState<'choose' | 'confirmDelete' | null>(null)
  const [msg, setMsg] = useState('')

  const status = !on
    ? t('sharing.sync.off')
    : !signedIn
      ? t('sharing.sync.needSignIn')
      : state === 'syncing'
        ? t('sharing.syncState.syncing')
        : state === 'error'
          ? t('sharing.sync.failed', { reason: error?.message ?? '' })
          : state === 'offline'
            ? t('sharing.syncState.offline')
            : state === 'conflict'
              ? t('sharing.syncState.conflict')
              : lastSyncedAt
                ? t('sharing.sync.syncedAt', { time: new Intl.DateTimeFormat(i18n.resolvedLanguage, TIME_24).format(lastSyncedAt) })
                : t('sharing.sync.waiting')

  const stop = async (deleteRemote: boolean) => {
    setClosing(null)
    try {
      await disable({ deleteRemote })
      setMsg(deleteRemote ? t('sharing.sync.deleted') : t('sharing.sync.stopped'))
    } catch {
      setMsg(t('sharing.sync.stopFailed'))
    }
  }

  return (
    <div className="mb-5 grid gap-2 rounded-(--radius-control) border border-line bg-oat/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-[length:calc(13px*var(--fs))] font-bold">
          <input
            type="checkbox"
            role="switch"
            aria-checked={on}
            checked={on}
            disabled={readOnly || (!on && !signedIn)}
            onChange={(e) => {
              setMsg('')
              if (e.target.checked) void enable()
              else setClosing('choose')
            }}
            className="size-4 accent-sage"
          />
          {t('sharing.sync.title')}
        </label>
        {on && signedIn && (
          <Button variant="ghost" className="px-3! py-1.5!" disabled={state === 'syncing' || readOnly} onClick={() => void syncNow()}>
            {t('sharing.sync.now')}
          </Button>
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted">{t('sharing.sync.help')}</p>
      <p role="status" className={`text-xs ${state === 'error' && on ? 'text-[#c2583d]' : 'text-sage-dark'}`}>
        {status}
      </p>
      {/* iOS App 不支援 Google 登入：說明只存在本機，不叫使用者去登入 */}
      {!on && !signedIn && <p className="text-xs text-muted">{isNativeApp() ? t('sharing.sync.native') : t('sharing.sync.needSignIn')}</p>}
      {msg && <p className="text-xs text-sage-dark">{msg}</p>}

      {closing && (
        <Dialog open onOpenChange={(o) => !o && setClosing(null)} title={t('sharing.sync.stopTitle')}>
          {closing === 'choose' ? (
            <div className="grid gap-3">
              <p className="text-sm text-muted">{t('sharing.sync.stopText')}</p>
              <Button variant="ghost" onClick={() => void stop(false)}>
                {t('sharing.sync.stopKeep')}
              </Button>
              <Button variant="danger" onClick={() => setClosing('confirmDelete')}>
                {t('sharing.sync.stopDelete')}
              </Button>
              <Button variant="ghost" onClick={() => setClosing(null)}>
                {t('common.cancel')}
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              <p role="alert" className="text-sm text-[#c2583d]">
                {t('sharing.sync.deleteConfirm')}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" className="ml-auto" onClick={() => setClosing('choose')}>
                  {t('common.cancel')}
                </Button>
                <Button variant="danger" onClick={() => void stop(true)}>
                  {t('sharing.sync.deleteForever')}
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      )}
    </div>
  )
}

/** 共享空間的本機快照清單，可以一鍵還原 */
export function SpacesSnapshots({ readOnly }: { readOnly: boolean }) {
  const { t, i18n } = useTranslation()
  const { ready, snapshots, load, backupNow, restore } = useSpacesBackupStore()
  const [msg, setMsg] = useState('')
  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{t('sharing.backup.title')}</h3>
        <Button
          variant="ghost"
          className="px-3! py-1.5!"
          disabled={readOnly}
          onClick={async () => setMsg((await backupNow('manual')) ? t('sharing.backup.done') : t('sharing.backup.same'))}
        >
          {t('sharing.backup.now')}
        </Button>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted">{t('sharing.backup.help')}</p>
      {ready && snapshots.length === 0 ? (
        <p className="text-xs text-muted">{t('sharing.backup.empty')}</p>
      ) : (
        <ul className="grid gap-1.5" aria-label={t('sharing.backup.title')}>
          {snapshots.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 text-[length:calc(13px*var(--fs))]">
              <span className="min-w-0 flex-1">
                {formatStamp(s.createdAt, i18n.resolvedLanguage)}
                <small className="ml-2 text-muted">
                  {t(`backup.reason.${s.reason}`)} · {t('sharing.backup.counts', { spaces: s.counts.spaces, items: s.counts.items })}
                </small>
              </span>
              {!readOnly && (
                <button
                  type="button"
                  className="text-xs font-semibold text-sage hover:text-sage-dark"
                  onClick={async () => {
                    if (!window.confirm(t('sharing.backup.restoreConfirm', { time: formatStamp(s.createdAt, i18n.resolvedLanguage) }))) return
                    try {
                      await restore(s.id)
                      setMsg(t('sharing.backup.restored'))
                    } catch (e) {
                      setMsg(t('sharing.backup.restoreFailed', { reason: e instanceof Error ? e.message : String(e) }))
                    }
                  }}
                >
                  {t('sharing.backup.restore')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {msg && (
        <p role="status" className="mt-2 text-xs text-sage-dark">
          {msg}
        </p>
      )}
    </div>
  )
}
