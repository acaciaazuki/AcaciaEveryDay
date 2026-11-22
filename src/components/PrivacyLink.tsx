import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

/** 低調的「隱私權政策」小文字連結，樣式跟第三方授權清單一致 */
export function PrivacyLink({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <Link
      to="/privacy"
      className={`text-[length:calc(10px*var(--fs))] text-[#a4afaa] underline-offset-2 transition-colors hover:text-sage-dark hover:underline ${className}`}
    >
      {t('privacy.link')}
    </Link>
  )
}
