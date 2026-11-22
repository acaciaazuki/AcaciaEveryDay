import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteAllData } from '../store/deleteAllData'
import { useSyncStore } from '../store/useSyncStore'
import { Button } from './Button'
import { PrivacyLink } from './PrivacyLink'

/** 設定頁「刪除所有資料」：刪除本機資料、自動備份，已登入時一併刪除 Drive 上的 ACACIA 檔案 */
export function DeleteDataPanel() {
  const { t } = useTranslation()
  const signedIn = useSyncStore((s) => s.token !== null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const onDelete = async () => {
    if (!window.confirm(signedIn ? t('deleteData.confirmCloud') : t('deleteData.confirmLocal'))) return
    setBusy(true)
    try {
      const r = await deleteAllData()
      setMsg(r.cloud ? t('deleteData.doneCloud') : t('deleteData.done'))
    } catch (e) {
      console.error('刪除資料失敗', e)
      setMsg(t('deleteData.fail'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-(--radius-card) bg-paper p-6 shadow-card">
      <h2 className="mb-1 font-bold">{t('deleteData.title')}</h2>
      <p className="mb-2 text-xs leading-relaxed text-muted">{t('deleteData.help')}</p>
      <p className="mb-4 text-xs leading-relaxed text-muted">{signedIn ? t('deleteData.cloudOn') : t('deleteData.cloudOff')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="danger" disabled={busy} onClick={() => void onDelete()}>
          {busy ? t('deleteData.deleting') : t('deleteData.button')}
        </Button>
        <PrivacyLink className="text-xs" />
      </div>
      {msg && (
        <p role="status" className="mt-3 text-xs text-sage-dark">
          {msg}
        </p>
      )}
    </section>
  )
}
