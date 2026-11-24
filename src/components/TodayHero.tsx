import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { WeatherArt } from './WeatherArt'

const stepBtn = 'grid size-[calc(28px*var(--fs))] place-items-center rounded-full bg-paper/85 text-base text-ink shadow-soft transition-colors hover:bg-paper'

export interface TodayStat {
  value: ReactNode
  label: string
}

/*
 * 三個斷點：手機 680px 以下、中屏 681–1279px（min-[681px]，跟側邊欄出現的寬度一致）、桌機 1280px 以上（min-[1280px]）。
 * class 名稱要完整寫出來，Tailwind 才掃描得到，不能用字串組合。
 */

/**
 * 「今天」頁頂部的問候與摘要橫幅（莫蘭迪灰綠底）。同一份結構，依寬度換三種排法：
 *
 * 桌機（1280px 以上）一列三區：
 *   [日期切換／天氣插畫＋大問候] │ [鼓勵文字] [三格白色數字卡]
 *   「查看月曆」「＋ 新增安排」收起來，新增改由側邊欄的主按鈕負責，月曆從側邊欄進入。
 * 中屏（681–1279px）左右兩欄：
 *   [日期切換／天氣插畫＋問候／鼓勵文字] [直向排列的兩顆按鈕]
 *   [三欄數字（中間細線分隔），橫跨整列]
 * 手機（680px 以下）直向堆疊：
 *   天氣插畫 → 日期切換 → 大問候 → 鼓勵文字 → 三欄數字 → 兩顆全寬按鈕
 *
 * 問候是整頁的 h1；字級跟著「設定 → 字體大小」縮放。
 */
export function TodayHero({
  dateLabel,
  greeting,
  night = false,
  onPrev,
  onNext,
  onBackToToday,
  stats,
  actions,
}: {
  dateLabel: string
  greeting: string
  /** 晚上（晚安、夜深了）時插畫換成月亮 */
  night?: boolean
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
      // 手機排在右上角浮動的搜尋鈕下方（clear-right），寬度才會跟下面的卡片對齊
      className={`mt-4 mb-6 clear-right grid gap-y-6 rounded-[24px] border border-[#d2ddd4]/70 bg-linear-to-br from-moss to-moss-deep px-6 py-7 shadow-soft min-[681px]:mb-7 min-[681px]:grid-cols-[minmax(0,1fr)_auto] min-[681px]:gap-x-10 min-[681px]:px-9 min-[681px]:py-8 min-[1280px]:grid-cols-[auto_1px_minmax(0,1fr)_auto] min-[1280px]:items-center min-[1280px]:gap-x-10 min-[1280px]:px-10 min-[1280px]:py-9`}
    >
      {/* 1. 日期切換＋天氣插畫＋大問候 */}
      <div data-hero-greet className={`grid grid-cols-1 gap-y-3 min-[681px]:col-[1] min-[681px]:row-[1] min-[681px]:grid-cols-[auto_minmax(0,1fr)] min-[681px]:items-center min-[681px]:gap-x-4`}>
        <div role="group" aria-label={t('today.dateNav')} className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[length:calc(14px*var(--fs))] tracking-wide text-[#55655d] min-[681px]:col-span-2`}>
          {/* ‹ 日期 › 是一組，不會被拆開換行 */}
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <button type="button" aria-label={t('today.prev')} onClick={onPrev} className={stepBtn}>
              ‹
            </button>
            <span>{dateLabel}</span>
            <button type="button" aria-label={t('today.next')} onClick={onNext} className={stepBtn}>
              ›
            </button>
          </span>
          {onBackToToday && (
            <button type="button" onClick={onBackToToday} className="rounded-full bg-paper/85 px-3 py-1 text-[length:calc(12px*var(--fs))] font-bold text-sage-dark hover:bg-paper">
              {t('today.backToToday')}
            </button>
          )}
        </div>
        <WeatherArt
          variant={night ? 'night' : 'day'}
          className={`-order-1 -ml-1 w-[calc(76px*var(--fs))] drop-shadow-[0_6px_10px_#4f6b5c1a] min-[681px]:order-none min-[681px]:w-[calc(84px*var(--fs))] min-[1280px]:w-[calc(96px*var(--fs))]`}
        />
        <h1 id="today-greeting" className={`text-[length:calc(30px*var(--fs))] leading-tight font-bold tracking-[0.12em] text-[#2b3832] min-[1280px]:text-[length:calc(36px*var(--fs))]`}>
          {greeting}
        </h1>
      </div>

      {/* 桌機：問候與文字之間的細分隔線 */}
      <span aria-hidden className={`hidden w-px self-stretch bg-[#b9c9bd]/70 min-[1280px]:col-[2] min-[1280px]:row-[1] min-[1280px]:my-2 min-[1280px]:block`} />

      {/* 2. 鼓勵文字 */}
      <div data-hero-message className={`-mt-2 text-[length:calc(15px*var(--fs))] leading-[1.8] text-[#4c5b54] min-[681px]:col-[1] min-[681px]:row-[2] min-[1280px]:col-[3] min-[1280px]:row-[1] min-[1280px]:mt-0 min-[1280px]:text-[length:calc(16px*var(--fs))]`}>
        <h2 className="font-semibold text-[#36443e]">{t('today.bannerTitle')}</h2>
        <p>{t('today.bannerText')}</p>
      </div>

      {/* 3. 摘要數字：手機與中屏是一條淡白底、細線分隔的三欄；桌機是三張白色小卡 */}
      <ul
        aria-label={t('today.summary')}
        className={`grid grid-cols-3 divide-x divide-[#c3d1c7] rounded-2xl bg-paper/45 py-3.5 min-[681px]:col-[1/-1] min-[681px]:row-[3] min-[1280px]:col-[4] min-[1280px]:row-[1] min-[1280px]:gap-3 min-[1280px]:divide-x-0 min-[1280px]:bg-transparent min-[1280px]:py-0`}
      >
        {stats.map((s) => (
          <li key={s.label} className={`grid justify-items-center gap-1.5 px-2 text-center min-[1280px]:min-w-[calc(104px*var(--fs))] min-[1280px]:rounded-2xl min-[1280px]:bg-paper/80 min-[1280px]:px-5 min-[1280px]:py-4 min-[1280px]:shadow-soft`}>
            <b className="text-[length:calc(24px*var(--fs))] leading-none font-semibold text-ink tabular-nums">{s.value}</b>
            <span className="text-[length:calc(13px*var(--fs))] whitespace-nowrap text-[#5f6e67]">{s.label}</span>
          </li>
        ))}
      </ul>

      {/* 4. 操作按鈕：手機全寬、中屏在右側直向排列；桌機收起（改用側邊欄） */}
      <div data-hero-actions className={`grid gap-3 [&>*]:w-full [&>*]:justify-center min-[681px]:col-[2] min-[681px]:row-[1/3] min-[681px]:min-w-[calc(200px*var(--fs))] min-[681px]:self-center min-[1280px]:hidden`}>
        {actions}
      </div>
    </section>
  )
}
