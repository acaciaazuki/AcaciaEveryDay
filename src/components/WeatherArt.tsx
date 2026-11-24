import { useId } from 'react'

/**
 * 今天頁問候旁的天氣插畫：柔和扁平、帶一點手繪感。
 * - day：暖黃太陽加一朵白雲
 * - night：奶油色彎月、兩顆小星星加一朵白雲（晚安、夜深了時使用）
 * 雲朵底下疊一層淡灰綠當陰影，看起來有厚度；純裝飾，對螢幕閱讀器隱藏。
 * 放在白色卡片上時傳 cloud={false}：只畫太陽／月亮，白雲在白底上會看不見。
 */
export function WeatherArt({ variant = 'day', cloud = true, className = '' }: { variant?: 'day' | 'night'; cloud?: boolean; className?: string }) {
  const id = useId()
  const sun = `${id}-sun`
  const moonMask = `${id}-moon`
  return (
    <svg viewBox={cloud ? '0 0 120 100' : '8 6 86 60'} className={className} aria-hidden data-weather={variant}>
      <defs>
        <radialGradient id={sun} cx="0.38" cy="0.34" r="0.75">
          <stop offset="0" stopColor="#ffe7a6" />
          <stop offset="1" stopColor="#f3bf55" />
        </radialGradient>
        <mask id={moonMask}>
          <rect width="120" height="100" fill="#fff" />
          <circle cx="62" cy="27" r="18" fill="#000" />
        </mask>
      </defs>

      {variant === 'day' ? (
        <g>
          {/* 光芒：八道圓頭短線 */}
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4
            return (
              <line
                key={i}
                x1={46 + Math.cos(a) * 29}
                y1={40 + Math.sin(a) * 29}
                x2={46 + Math.cos(a) * 37}
                y2={40 + Math.sin(a) * 37}
                stroke="#f2c661"
                strokeWidth="5"
                strokeLinecap="round"
              />
            )
          })}
          <circle cx="46" cy="40" r="22" fill={`url(#${sun})`} />
        </g>
      ) : (
        <g>
          <circle cx="46" cy="38" r="22" fill="#f6dc94" mask={`url(#${moonMask})`} />
          <path d="M18 18l1.6 4.2 4.2 1.6-4.2 1.6L18 29.6l-1.6-4.2-4.2-1.6 4.2-1.6z" fill="#f6dc94" />
          <path d="M86 12l1.1 2.9 2.9 1.1-2.9 1.1L86 20l-1.1-2.9-2.9-1.1 2.9-1.1z" fill="#f2e3b5" />
        </g>
      )}

      {/* 雲：先畫往下偏移的淡灰綠陰影，再疊白色本體 */}
      {cloud && (
        <>
          <g fill="#c6d4cb" transform="translate(2 4)">
            <Cloud />
          </g>
          <g fill="#ffffff">
            <Cloud />
          </g>
        </>
      )}
    </svg>
  )
}

function Cloud() {
  return (
    <>
      <circle cx="49" cy="72" r="14" />
      <circle cx="72" cy="60" r="20" />
      <circle cx="95" cy="71" r="15" />
      <rect x="49" y="66" width="46" height="20" />
    </>
  )
}
