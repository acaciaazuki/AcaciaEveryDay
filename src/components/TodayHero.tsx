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
 * 「今天」頁頂部的問候與概覽卡片，分成兩層，功能與訊息不擠在同一列：
 * 1. 工具列：左邊日期切換（小字、淡色），右邊「查看月曆」「＋ 新增安排」；窄螢幕時按鈕換到下一行
 * 2. 內容：天氣圖示在左，右邊由上而下是問候、標語、說明文字、摘要膠囊，各自留出清楚的停頓
 * 問候是整頁的 h1。字級沿用原本設定（跟著「設定 → 字體大小」縮放），層次靠間距、粗細與深淺拉開。
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
      className="mt-4 mb-8 clear-right rounded-[calc(var(--radius-card)+4px)] bg-linear-to-br from-mint to-sage-light px-6 py-6 sm:px-9 sm:py-8"
    >
      {/* 1. 工具列：日期切換｜操作按鈕 */}
      <div data-hero-toolbar className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div role="group" aria-label={t('today.dateNav')} className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 tracking-wide text-[#6f8078] ${TEXT_14}`}>
          {/* ‹ 日期 › 是一組，不會被拆開換行 */}
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <button type="button" aria-label={t('today.prev')} onClick={onPrev} className={stepBtn}>
              ‹
            </button>
            <span>{dateLabel}</span>
            <button type="button" aria-label={t('today.next')} onClick={onNext} className={stepBtn}>
              ›
            </button>
          </span>
          {onBackToToday && (
            <button type="button" onClick={onBackToToday} className="rounded-full bg-paper/80 px-2.5 py-1 text-[length:calc(11px*var(--fs))] font-bold text-sage-dark hover:bg-mint">
              {t('today.backToToday')}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
      </div>

      {/* 2. 內容：天氣圖示｜問候、標語、摘要 */}
      <div data-hero-body className="mt-7 flex items-start gap-5 sm:mt-8 sm:gap-7">
        <span className="grid size-[calc(64px*var(--fs))] shrink-0 place-items-center rounded-full bg-paper/75 text-[#5f7a70] shadow-soft" aria-hidden>
          <Icon name="cloudSun" className="size-[70%]" />
        </span>
        <div className="min-w-0 pt-1">
          <h1 id="today-greeting" className={`font-extrabold tracking-wide text-sage-dark ${TEXT_13}`}>
            {greeting}
          </h1>
          <h2 className={`mt-3 font-extrabold leading-relaxed ${TEXT_13}`}>{t('today.bannerTitle')}</h2>
          <p className={`mt-1 leading-relaxed text-[#5b6b63] ${TEXT_13}`}>{t('today.bannerText')}</p>
          <ul aria-label={t('today.summary')} className="mt-5 flex flex-wrap gap-2.5">
            {stats.map((s) => (
              <li key={s.label} className={`rounded-full bg-paper/85 px-4 py-2 text-[#55645d] ${TEXT_14}`}>
                <b className="mr-1.5 text-ink">{s.value}</b>
                {s.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
