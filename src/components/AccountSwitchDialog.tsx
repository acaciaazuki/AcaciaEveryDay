import { useTranslation } from 'react-i18next'
import { useSyncStore } from '../store/useSyncStore'
import { Button } from './Button'
import { Dialog } from './Dialog'

/**
 * 登入的 Google 帳號跟這台裝置上次同步的帳號不同時，詢問要怎麼處理本機資料。
 * 預設（第一個、自動聚焦）是切換帳號：本機舊資料先留快照再清空，改用新帳號的雲端資料，避免跨帳號合併。
 * 關閉對話框等同取消，本機與雲端都不動。只在 Layout 掛一次（SyncPanel 會同時出現在側欄與設定頁）。
 */
export function AccountSwitchDialog() {
  const { t } = useTranslation()
  const pending = useSyncStore((s) => s.accountSwitch)
  const resolve = useSyncStore((s) => s.resolveAccountSwitch)
  if (!pending) return null

  const option = (choice: 'switch' | 'merge', variant: 'primary' | 'ghost') => (
    <Button variant={variant} autoFocus={choice === 'switch'} data-account-choice={choice} onClick={() => void resolve(choice)} className="grid gap-1 text-left">
      <span className="text-[length:calc(13px*var(--fs))]">
        {t(`sync.accountSwitch.${choice}`)}
        {choice === 'switch' && <span className="ml-2 rounded-full bg-white/25 px-2 py-0.5 text-[length:calc(10px*var(--fs))]">{t('sync.accountSwitch.recommended')}</span>}
      </span>
      <span className={`text-[length:calc(11px*var(--fs))] font-normal leading-relaxed ${variant === 'primary' ? 'text-white/90' : 'text-muted'}`}>{t(`sync.accountSwitch.${choice}Desc`)}</span>
    </Button>
  )

  return (
    <Dialog open onOpenChange={(o) => !o && void resolve('cancel')} title={t('sync.accountSwitch.title')}>
      <p className="mb-4 text-[length:calc(13px*var(--fs))] leading-relaxed text-muted">{t('sync.accountSwitch.intro', { name: pending.name || t('sync.user') })}</p>
      <div className="grid gap-2">
        {option('switch', 'primary')}
        {option('merge', 'ghost')}
        <Button variant="ghost" data-account-choice="cancel" onClick={() => void resolve('cancel')}>
          {t('sync.accountSwitch.cancel')}
        </Button>
      </div>
    </Dialog>
  )
}
