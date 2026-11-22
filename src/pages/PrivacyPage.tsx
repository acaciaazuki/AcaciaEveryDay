import { useNavigate } from 'react-router'
import PrivacyDialog from '../components/PrivacyDialog'
import { TodayPage } from './TodayPage'

/**
 * /privacy：公開可直接連結的網址（App Store／Google 審核需要）。
 * 打開時以「今天」頁為背景，自動跳出隱私權政策面板；關閉後回到首頁。
 */
export function PrivacyPage() {
  const navigate = useNavigate()
  return (
    <>
      <TodayPage />
      <PrivacyDialog open onOpenChange={(o) => !o && navigate('/', { replace: true })} />
    </>
  )
}
