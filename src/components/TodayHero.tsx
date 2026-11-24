import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from './AcaciaIcons'

/** 字級（跟著設定裡的字體大小縮放） */
const TEXT_13 = 'text-[length:calc(13px*var(--fs))]'
const TEXT_14 = 'text-[length:calc(14px*var(--fs))]'
const stepBtn = 'grid size-7 place-items-center rounded-full border border-line bg-paper text-base text-ink hover:bg-sage-light'

export interface TodayStat {
  value: ReactNode
  label: string
}

/**
 * 「今天」頁頂部的問候與概覽橫幅（取代原本的頁面標頭＋下方橫幅兩塊）。
 * - 寬螢幕（1280px 以上）由左到右一列：日期切換＋問候＋天氣圖示｜標語＋摘要膠囊｜查看月曆、＋ 新增安排
 * - 平板與一般筆電（681–1279px）兩列：日期與問候｜按鈕，下一列是標語與摘要（中間欄太窄時不擠成好幾行）
 * - 手機依序直向堆疊
 * 問候是整頁的 h1。
 */
export function TodayHero({
  dateLabel,
  greeting,
  onPrev,
  onNext,
  onBackToToday,
  stats,
  actions,
}: {
  dateLabel: string
  greeting: string
  onPrev: () => void
  onNext: () => void
  /** 不在今天時才傳，顯示「回到今天」 */
  onBackToToday?: () => void
  stats: TodayStat[]
  actions: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <section
      data-page-head
      aria-labelledby="today-greeting"
      // 手機（680px 以下）排在右上角浮動的搜尋鈕下方，寬度才會跟下面的卡片對齊
      className="mt-4 mb-5 grid clear-right gap-x-8 gap-y-4 rounded-(--radius-card) bg-linear-to-br from-mint to-sage-light p-5 sm:p-6 min-[681px]:grid-cols-[minmax(0,1fr)_auto] min-[681px]:items-center min-[1280px]:grid-cols-[auto_minmax(0,1fr)_auto]"
    >
      {/* 左：日期切換、問候與天氣圖示 */}
      <div className="flex items-start justify-between gap-6 min-[681px]:justify-start">
        <div className="grid gap-2">
          <div role="group" aria-label={t('today.dateNav')} className={`flex flex-wrap items-center gap-1.5 tracking-wide text-muted ${TEXT_14}`}>
            <button type="button" aria-label={t('today.prev')} onClick={onPrev} className={stepBtn}>
              ‹
            </button>
            <span>{dateLabel}</span>
            <button type="button" aria-label={t('today.next')} onClick={onNext} className={stepBtn}>
              ›
            </button>
            {onBackToToday && (
              <button type="button" onClick={onBackToToday} className="rounded-full bg-paper/80 px-2.5 py-1 text-[length:calc(11px*var(--fs))] font-bold text-sage-dark hover:bg-mint">
                {t('today.backToToday')}
              </button>
            )}
          </div>
          <h1 id="today-greeting" className={`font-extrabold tracking-tight ${TEXT_13}`}>
            {greeting}
          </h1>
        </div>
        <span className="shrink-0 text-[calc(34px*var(--fs))] text-[#5f7a70] min-[1280px]:text-[calc(44px*var(--fs))]" aria-hidden>
          <Icon name="cloudSun" className="size-[1.8em]" />
        </span>
      </div>

      {/* 中：標語與摘要膠囊 */}
      <div className="min-w-0 min-[681px]:col-span-2 min-[681px]:row-start-2 min-[1280px]:col-span-1 min-[1280px]:col-start-2 min-[1280px]:row-start-1">
        <h2 className={`mb-1 font-extrabold ${TEXT_13}`}>{t('today.bannerTitle')}</h2>
        <p className={`mb-3 text-[#55645d] ${TEXT_13}`}>{t('today.bannerText')}</p>
        <ul aria-label={t('today.summary')} className="flex flex-wrap gap-2">
          {stats.map((s) => (
            <li key={s.label} className={`rounded-full bg-paper/80 px-3.5 py-2 text-[#55645d] ${TEXT_14}`}>
              <b className="mr-1 text-ink">{s.value}</b>
              {s.label}
            </li>
          ))}
        </ul>
      </div>

      {/* 右：查看月曆、＋ 新增安排 */}
      <div className="flex flex-wrap gap-2 min-[681px]:col-start-2 min-[681px]:row-start-1 min-[681px]:flex-nowrap min-[681px]:justify-end min-[1280px]:col-start-3">{actions}</div>
    </section>
  )
}
