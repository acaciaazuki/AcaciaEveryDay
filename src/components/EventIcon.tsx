import type { ReactNode } from 'react'
import { ICON_BG, type EventIconKey } from '../core/eventIcons'

/* 圓潤線條 + 柔和粉彩填色的小插畫，24×24 */
const L = '#6f7f78' // 線條色（柔和的灰綠，不用純黑）
const line = { stroke: L, strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const ART: Record<EventIconKey, ReactNode> = {
  // 鬧鐘
  wake: (
    <>
      <circle cx="6.3" cy="6.3" r="2.3" fill="#f7b7a3" {...line} />
      <circle cx="17.7" cy="6.3" r="2.3" fill="#f7b7a3" {...line} />
      <circle cx="12" cy="13.2" r="7" fill="#fff7dc" {...line} />
      <path d="M12 9.6v3.8l2.4 1.4" fill="none" {...line} />
      <path d="M8 20.2l-1.2 1.3M16 20.2l1.2 1.3" fill="none" {...line} />
    </>
  ),
  // 月亮與小星星
  sleep: (
    <>
      <path d="M17.6 15.6A7.2 7.2 0 0 1 8.4 6.4a7.2 7.2 0 1 0 9.2 9.2z" fill="#e4dbfa" {...line} />
      <path d="M17.5 5.2l.7 1.5 1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7z" fill="#ffe08a" stroke={L} strokeWidth="1" strokeLinejoin="round" />
    </>
  ),
  // 書本
  study: (
    <>
      <path d="M5 5.6A1.6 1.6 0 0 1 6.6 4H18.5v14H6.6A1.6 1.6 0 0 0 5 19.6z" fill="#cfe6f6" {...line} />
      <path d="M5 19.6A1.6 1.6 0 0 1 6.6 18H18.5v2.4H6.6A1.6 1.6 0 0 1 5 19.6z" fill="#fff7dc" {...line} />
      <path d="M14.2 4v5.2l1.7-1.2 1.7 1.2V4" fill="#f7b7a3" {...line} />
    </>
  ),
  // 公事包
  work: (
    <>
      <path d="M9 8V6.4A1.4 1.4 0 0 1 10.4 5h3.2A1.4 1.4 0 0 1 15 6.4V8" fill="none" {...line} />
      <rect x="3.5" y="8" width="17" height="11.5" rx="2.6" fill="#f6d5bb" {...line} />
      <path d="M3.5 12.8h17" fill="none" {...line} />
      <rect x="10.5" y="11.4" width="3" height="2.9" rx="1" fill="#fff7dc" {...line} />
    </>
  ),
  // 咖啡杯與熱氣
  rest: (
    <>
      <path d="M9 3.6c-.8 1 .8 1.6 0 2.7M13 3.6c-.8 1 .8 1.6 0 2.7" fill="none" {...line} />
      <path d="M5 9h11v5.2A4.8 4.8 0 0 1 11.2 19H9.8A4.8 4.8 0 0 1 5 14.2z" fill="#fbdcb9" {...line} />
      <path d="M16 10.2h1.4a2.2 2.2 0 0 1 0 4.4H16" fill="none" {...line} />
      <path d="M4 21h13" fill="none" {...line} />
    </>
  ),
  // 飯碗與筷子
  meal: (
    <>
      <path d="M4 11.2h16a8 8 0 0 1-16 0z" fill="#ffd9d0" {...line} />
      <path d="M8 19.4h8" fill="none" {...line} />
      <path d="M14 3.2l4.4 6M17 3.2l1.6 6" fill="none" {...line} />
      <circle cx="9.5" cy="9.4" r="1.6" fill="#fff7dc" stroke={L} strokeWidth="1" />
    </>
  ),
  // 購物袋
  shopping: (
    <>
      <path d="M5.2 8.2h13.6l1 11.3a1.6 1.6 0 0 1-1.6 1.7H5.8a1.6 1.6 0 0 1-1.6-1.7z" fill="#cfeadb" {...line} />
      <path d="M8.6 10.6V7a3.4 3.4 0 0 1 6.8 0v3.6" fill="none" {...line} />
      <path d="M12 14.2c-1.6-1.6-3.4.4-1.6 1.9l1.6 1.4 1.6-1.4c1.8-1.5 0-3.5-1.6-1.9z" fill="#f7b7a3" stroke="none" />
    </>
  ),
  // 啞鈴
  exercise: (
    <>
      <rect x="3" y="9" width="3.2" height="6" rx="1.2" fill="#f7b7a3" {...line} />
      <rect x="17.8" y="9" width="3.2" height="6" rx="1.2" fill="#f7b7a3" {...line} />
      <rect x="6.2" y="7" width="3" height="10" rx="1.3" fill="#d4ebd0" {...line} />
      <rect x="14.8" y="7" width="3" height="10" rx="1.3" fill="#d4ebd0" {...line} />
      <path d="M9.2 12h5.6" fill="none" {...line} />
    </>
  ),
  // 急救包
  health: (
    <>
      <path d="M9 8V6.4A1.4 1.4 0 0 1 10.4 5h3.2A1.4 1.4 0 0 1 15 6.4V8" fill="none" {...line} />
      <rect x="3.5" y="8" width="17" height="11.5" rx="2.8" fill="#fbd3d0" {...line} />
      <path d="M12 11.2v5.2M9.4 13.8h5.2" stroke="#e07f78" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  // 日曆與星星
  default: (
    <>
      <rect x="4" y="5.4" width="16" height="14.6" rx="3" fill="#dff2e9" {...line} />
      <path d="M4 10h16" fill="none" {...line} />
      <path d="M8.4 3.6v3.4M15.6 3.6v3.4" fill="none" {...line} />
      <path d="M12 12.2l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z" fill="#ffe08a" stroke={L} strokeWidth="1" strokeLinejoin="round" />
    </>
  ),
}

/** 只有小插畫，沒有底框（選擇器、預覽用） */
export function EventIconArt({ icon, size = 24 }: { icon: EventIconKey; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden focusable="false">
      {ART[icon]}
    </svg>
  )
}

/** 圓形粉彩底框 + 小插畫，時間軸用 */
export function EventIconBadge({ icon, className = '' }: { icon: EventIconKey; className?: string }) {
  return (
    <span data-icon={icon} className={`grid size-10 shrink-0 place-items-center rounded-full ${className}`} style={{ background: ICON_BG[icon] }}>
      <EventIconArt icon={icon} size={24} />
    </span>
  )
}
