import { useTranslation } from 'react-i18next'
import { PageHead } from '../components/PageHead'

export function ComingSoon({ page }: { page: 'today' | 'calendar' | 'places' }) {
  const { t } = useTranslation()
  return (
    <>
      <PageHead eyebrow={t(`${page}.eyebrow`)} title={t(`${page}.title`)} />
      <div className="rounded-(--radius-card) bg-paper p-10 text-center text-muted shadow-card">{t('common.comingSoon')}</div>
    </>
  )
}
