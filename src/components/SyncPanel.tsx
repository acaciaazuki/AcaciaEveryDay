import { Icon } from './AcaciaIcons'
import { useTranslation } from 'react-i18next'
import { useSyncStore } from '../store/useSyncStore'
import { TIME_24 } from '../core/time'
import { isNativeApp } from '../adapters/kv'

/**
 * 側欄底部與設定頁的同步狀態與登入按鈕。
 * iOS App 目前不支援 Google 登入（Google 不允許在 App 內嵌的網頁做 OAuth）：不顯示登入按鈕，改成說明只有本機與 iCloud 備份有效。
 */
export function SyncPanel({ showHelp = false }: { showHelp?: boolean }) {
  const { t, i18n } = useTranslation()
  const { status, profile, lastSyncedAt, connect, reauthorize, disconnect, push } = useSyncStore()
  const signedIn = status !== 'signedOut' && status !== 'connecting' && status !== 'confirmAccount'
  const native = isNativeApp()

  const statusText = {
    signedOut: native ? t('sync.nativeStatus') : t('sync.localOnly'),
    connecting: t('sync.connecting'),
    syncing: t('sync.syncing'),
    synced: t('sync.synced', { time: lastSyncedAt ? new Intl.DateTimeFormat(i18n.resolvedLanguage, TIME_24).format(lastSyncedAt) : '' }),
    error: t('sync.error'),
    needsPermission: t('sync.needsPermission'),
    confirmAccount: t('sync.confirmAccount'),
  }[status]

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-mint text-lg">
          {profile?.picture ? <img src={profile.picture} alt="" referrerPolicy="no-referrer" className="size-full object-cover" /> : <Icon name="user" className="size-[70%] text-[#5f7a70]" />}
        </div>
        <div className="min-w-0">
          <strong className="block truncate text-[length:calc(13px*var(--fs))]">{signedIn ? profile?.name || t('sync.user') : t('sync.guest')}</strong>
          <small role="status" className="block text-[length:calc(11px*var(--fs))] text-muted">
            {statusText}
          </small>
        </div>
      </div>
      {showHelp && !native && <p className="text-xs leading-relaxed text-muted">{t('sync.help')}</p>}
      {status === 'needsPermission' && (
        <p role="alert" className="rounded-(--radius-control) bg-sage-light px-3 py-2 text-[length:calc(11px*var(--fs))] leading-relaxed text-sage-dark">
          {t('sync.needsPermissionHelp')}
        </p>
      )}
      {native ? (
        <p role="note" data-native-sync-notice className="rounded-(--radius-control) bg-sage-light px-3 py-2 text-[length:calc(11px*var(--fs))] leading-relaxed text-sage-dark">
          {t('sync.nativeNotice')}
        </p>
      ) : (
        <div className="flex gap-2">
          {signedIn ? (
            <>
              {status === 'needsPermission' && (
                <button type="button" onClick={() => void reauthorize()} className="flex-1 rounded-(--radius-control) bg-sage px-3 py-2 text-xs font-bold text-white">
                  {t('sync.grantPermission')}
                </button>
              )}
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
              disabled={status === 'connecting' || status === 'confirmAccount'}
              onClick={() => void connect(true)}
              className="flex-1 rounded-(--radius-control) bg-sage-light px-3 py-2 text-xs font-bold text-sage-dark hover:bg-mint disabled:opacity-60"
            >
              {t('sync.signIn')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
