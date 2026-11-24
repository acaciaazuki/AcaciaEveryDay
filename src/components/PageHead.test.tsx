import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PAGE_TITLE_SIZE, PageHead } from './PageHead'

describe('PageHead', () => {
  it('主標題用全站統一的 13px（跟著字體設定縮放），沒傳 eyebrow 就不輸出任何小字', () => {
    const { container } = render(<PageHead title="標題" />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(PAGE_TITLE_SIZE).toBe('text-[length:calc(13px*var(--fs))]')
    expect(h1).toHaveClass(PAGE_TITLE_SIZE)
    expect(h1).not.toHaveClass('text-2xl')
    // 標題區塊裡只有標題本身，沒有留下空的小字列
    expect(h1.parentElement!.children).toHaveLength(1)
    expect(container.querySelector('.text-muted')).toBeNull()
  })

  it('有功能的列（例如今天頁的日期切換）照常顯示在標題上方', () => {
    render(<PageHead eyebrow={<button type="button">‹</button>} title="晚安" eyebrowClassName="text-[length:calc(14px*var(--fs))]" />)
    expect(screen.getByRole('button', { name: '‹' }).parentElement).toHaveClass('text-[length:calc(14px*var(--fs))]')
    expect(screen.getByRole('heading', { level: 1, name: '晚安' })).toHaveClass(PAGE_TITLE_SIZE)
  })
})
