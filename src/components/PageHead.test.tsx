import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHead } from './PageHead'

describe('PageHead', () => {
  it('預設字級跟原本一樣，其他頁面不受影響', () => {
    render(<PageHead eyebrow="小字" title="標題" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('text-2xl')
    expect(screen.getByText('小字')).toHaveClass('text-[length:calc(11px*var(--fs))]')
  })

  it('個別頁面可以調整字級', () => {
    render(<PageHead eyebrow="小字" title="標題" titleClassName="text-[length:calc(30px*var(--fs))]" eyebrowClassName="text-[length:calc(12px*var(--fs))]" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('text-[length:calc(30px*var(--fs))]')
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveClass('text-2xl')
    expect(screen.getByText('小字')).toHaveClass('text-[length:calc(12px*var(--fs))]')
  })
})
