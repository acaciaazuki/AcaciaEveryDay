import { useTranslation } from 'react-i18next'
import { useSyncStore } from '../store/useSyncStore'

/** 側欄底部與設定頁的同步狀態與登入按鈕 */
export function SyncPanel({ showHelp = false }: { showHelp?: boolean }) {
  const { t, i18n } = useTranslation()
  const { status, profile, lastSyncedAt, connect, disconnect, push } = useSyncStore()
  const signedIn = status !== 'signedOut' && status !== 'connecting'

  const statusText = {
    signedOut: t('sync.localOnly'),
    connecting: t('sync.connecting'),
    syncing: t('sync.syncing'),
    synced: t('sync.synced', { time: lastSyncedAt ? new Intl.DateTimeFormat(i18n.resolvedLanguage, { timeStyle: 'short' }).format(lastSyncedAt) : '' }),
    error: t('sync.error'),
  }[status]

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-mint text-lg">
          {profile?.picture ? <img src={profile.picture} alt="" referrerPolicy="no-referrer" className="size-full object-cover" /> : '🐻'}
        </div>
        <div className="min-w-0">
          <strong className="block truncate text-[13px]">{signedIn ? profile?.name || t('sync.user') : t('sync.guest')}</strong>
          <small role="status" className="block text-[11px] text-muted">
            {statusText}
          </small>
        </div>
      </div>
      {showHelp && <p className="text-xs leading-relaxed text-muted">{t('sync.help')}</p>}
      <div className="flex gap-2">
        {signedIn ? (
          <>
            {status === 'error' && (
              <button type="button" onClick={() => void push()} className="flex-1 rounded-(--radius-control) bg-sage px-3 py-2 text-xs font-bold text-white">
                {t('sync.retry')}
              </button>
            )}
            <button
              type="button"
              onClick={() => window.confirm(t('sync.signOutConfirm')) && void disconnect()}
              className="flex-1 rounded-(--radius-control) border border-line bg-paper px-3 py-2 text-xs font-bold text-muted hover:bg-oat"
            >
              {t('sync.signOut')}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={status === 'connecting'}
            onClick={() => void connect(true)}
            className="flex-1 rounded-(--radius-control) bg-sage-light px-3 py-2 text-xs font-bold text-sage-dark hover:bg-mint disabled:opacity-60"
          >
            {t('sync.signIn')}
          </button>
        )}
      </div>
    </div>
  )
}
