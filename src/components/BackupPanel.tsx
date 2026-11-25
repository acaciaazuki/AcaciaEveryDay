import { useEffect, useState } from 'react'
import { isNativeApp } from '../adapters/kv'
import { useTranslation } from 'react-i18next'
import { MAX_SNAPSHOTS } from '../core/backup'
import { formatStamp } from '../core/time'
import { useBackupStore } from '../store/useBackupStore'
import { useSyncStore } from '../store/useSyncStore'
import { AcaciaBranch } from './BrandMark'
import { Button } from './Button'

/** 設定頁「資料備份與搬家」裡的自動備份：狀態、開關、立即備份與歷史快照還原 */
export function BackupPanel() {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage ?? 'zh-TW'
  const { ready, enabled, lastAt, snapshots, cloudStatus, cloudAt, load, setEnabled, backupNow, restore } = useBackupStore()
  const signedIn = useSyncStore((s) => s.token !== null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    void load()
  }, [load])

  const run = async (fn: () => Promise<string>) => {
    setBusy(true)
    try {
      setMsg(await fn())
    } catch (e) {
      console.error(e)
      setMsg(t('backup.fail'))
    } finally {
      setBusy(false)
    }
  }

  const onBackup = () => run(async () => ((await backupNow('manual')) ? t('backup.done') : t('backup.unchanged')))

  const onRestore = (id: string, createdAt: number) => {
    if (!window.confirm(t('backup.restoreConfirm', { time: formatStamp(createdAt, lng) }))) return
    void run(async () => {
      await restore(id)
      return t('backup.restored', { time: formatStamp(createdAt, lng) })
    })
  }

  // iOS App 不支援 Google 登入：雲端備份槽不可用，快照只在這台 iPhone（隨 iCloud 備份）
  const cloudText = isNativeApp()
    ? t('backup.cloud.native')
    : signedIn && cloudStatus !== 'idle'
      ? { uploading: t('backup.cloud.uploading'), ok: t('backup.cloud.ok', { time: cloudAt ? formatStamp(cloudAt, lng) : '' }), error: t('backup.cloud.error') }[cloudStatus]
      : signedIn
        ? t('backup.cloud.waiting')
        : t('backup.cloud.signedOut')

  return (
    <div className="mt-5 grid gap-3 border-t border-line pt-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            {/* 備份標誌：備份或上傳雲端時輕輕擺動 */}
            <AcaciaBranch className="w-12 shrink-0" active={busy || (signedIn && cloudStatus === 'uploading')} />
            {t('backup.title')}
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{t('backup.help', { count: MAX_SNAPSHOTS })}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t('backup.toggle')}
          disabled={!ready}
          onClick={() => void setEnabled(!enabled)}
          className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-sage' : 'bg-[#d5ddd9]'}`}
        >
          <span aria-hidden className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      <dl className="grid gap-1 rounded-(--radius-control) bg-oat px-3 py-2.5 text-xs">
        <div className="flex flex-wrap justify-between gap-x-3">
          <dt className="text-muted">{t('backup.lastAt')}</dt>
          <dd className="font-bold" data-testid="backup-last">
            {lastAt ? formatStamp(lastAt, lng) : t('backup.never')}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-3">
          <dt className="text-muted">{t('backup.cloud.label')}</dt>
          <dd className={cloudStatus === 'error' && signedIn ? 'font-bold text-[#c2583d]' : 'text-muted'}>{cloudText}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" disabled={busy || !ready} onClick={() => void onBackup()}>
          {t('backup.now')}
        </Button>
        {!enabled && <span className="text-xs text-muted">{t('backup.offNote')}</span>}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-bold text-muted">{t('backup.history', { count: snapshots.length, max: MAX_SNAPSHOTS })}</h4>
        {snapshots.length === 0 ? (
          <p className="text-xs text-muted">{t('backup.empty')}</p>
        ) : (
          <ul className="grid gap-2" aria-label={t('backup.historyLabel')}>
            {snapshots.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-(--radius-control) border border-line px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs font-bold">
                    {formatStamp(s.createdAt, lng)}
                    <span className={`rounded-full px-2 py-0.5 text-[length:calc(10px*var(--fs))] ${s.reason === 'beforeRestore' || s.reason === 'beforeMigration' || s.reason === 'beforeAccountSwitch' ? 'bg-[#fcf5d7] text-[#8a6d1d]' : 'bg-sage-light text-sage-dark'}`}>
                      {t(`backup.reason.${s.reason}`)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[length:calc(11px*var(--fs))] text-muted">{t('backup.counts', { ...s.counts })}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRestore(s.id, s.createdAt)}
                  aria-label={t('backup.restoreLabel', { time: formatStamp(s.createdAt, lng) })}
                  className="shrink-0 rounded-(--radius-control) border border-line bg-paper px-3 py-2 text-xs font-bold text-sage-dark hover:bg-sage-light disabled:opacity-50"
                >
                  {t('backup.restore')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {msg && (
        <p role="status" className="text-xs text-sage-dark">
          {msg}
        </p>
      )}
    </div>
  )
}
