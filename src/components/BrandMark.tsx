/** 品牌標誌：淡薄荷綠圓角底＋六瓣花。和 public/favicon.svg 是同一張圖，改一邊記得改另一邊 */
export function BrandMark({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <rect width="64" height="64" rx="16" fill="#dff2e9" />
      <g fill="#3d876c">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse key={a} cx="32" cy="19.5" rx="6.2" ry="11.5" transform={`rotate(${a} 32 32)`} />
        ))}
      </g>
      <circle cx="32" cy="32" r="5.5" fill="#dff2e9" />
    </svg>
  )
}
