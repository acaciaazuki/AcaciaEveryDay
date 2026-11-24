import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { TodayHero } from './TodayHero'

const setup = (extra: Partial<Parameters<typeof TodayHero>[0]> = {}) => {
  const props = {
    dateLabel: '2026年11月24日 星期二',
    greeting: '晚安',
    onPrev: vi.fn(),
    onNext: vi.fn(),
    stats: [
      { value: 3, label: '個行程' },
      { value: 2, label: '個待辦' },
      { value: '15.8h', label: '自由時間' },
    ],
    actions: <button type="button">＋ 新增安排</button>,
    ...extra,
  }
  render(<TodayHero {...props} />)
  return props
}

describe('今天頁的問候與概覽橫幅', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
  })

  it('同一張橫幅裡有：日期切換、問候（h1）、天氣圖示、標語、摘要膠囊、操作按鈕', () => {
    setup()
    const hero = screen.getByRole('region', { name: '晚安' })
    expect(hero).toHaveAttribute('data-page-head')
    const nav = within(hero).getByRole('group', { name: '切換日期' })
    expect(nav).toHaveTextContent('2026年11月24日 星期二')
    expect(within(hero).getByRole('heading', { level: 1, name: '晚安' })).toHaveClass('text-[length:calc(13px*var(--fs))]')
    expect(hero.querySelector('[aria-hidden] svg')).not.toBeNull()
    expect(within(hero).getByRole('heading', { level: 2, name: '慢慢來，一切都會剛剛好。' })).toBeInTheDocument()
    expect(within(hero).getByText('你有幾件重要的事，還有足夠的空檔好好呼吸。')).toBeInTheDocument()
    const stats = within(within(hero).getByRole('list', { name: '今天的摘要' })).getAllByRole('listitem')
    expect(stats.map((li) => li.textContent)).toEqual(['3個行程', '2個待辦', '15.8h自由時間'])
    expect(within(hero).getByRole('button', { name: '＋ 新增安排' })).toBeInTheDocument()
  })

  it('寬螢幕一列三塊；平板與一般筆電可換行（按鈕放不下時換到下一列），摘要在最下面；手機直向堆疊', () => {
    setup()
    const hero = screen.getByRole('region', { name: '晚安' })
    expect(hero).toHaveClass('grid', 'min-[681px]:flex', 'min-[681px]:flex-wrap', 'min-[1280px]:grid', 'min-[1280px]:grid-cols-[auto_minmax(0,1fr)_auto]')
    expect(hero.children).toHaveLength(3)
    const [, summary, actions] = [...hero.children]
    expect(summary).toHaveClass('min-[681px]:order-3', 'min-[681px]:basis-full', 'min-[1280px]:col-start-2', 'min-[1280px]:border-l')
    expect(actions).toHaveClass('min-[681px]:order-2', 'min-[681px]:ml-auto', 'min-[1280px]:col-start-3')
  })

  it('‹ 日期 › 是不換行的一組；天氣圖示跟日期、問候放在一起', () => {
    setup()
    const nav = screen.getByRole('group', { name: '切換日期' })
    const trio = screen.getByRole('button', { name: '往前' }).parentElement!
    expect(trio).toHaveClass('whitespace-nowrap')
    expect(trio).toHaveTextContent('2026年11月24日 星期二')
    expect(within(trio).getByRole('button', { name: '往後' })).toBeInTheDocument()
    // 日期列 → 日期與問候 → 左側一組（含天氣圖示）
    const left = nav.parentElement!.parentElement!
    expect(left.querySelector('[aria-hidden] svg')).not.toBeNull()
    expect(within(left as HTMLElement).getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('前後切換日期；不在今天時才顯示「回到今天」', () => {
    const props = setup()
    fireEvent.click(screen.getByRole('button', { name: '往前' }))
    fireEvent.click(screen.getByRole('button', { name: '往後' }))
    expect(props.onPrev).toHaveBeenCalledTimes(1)
    expect(props.onNext).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: '回到今天' })).not.toBeInTheDocument()
  })

  it('有「回到今天」時可以點', () => {
    const onBackToToday = vi.fn()
    setup({ onBackToToday })
    fireEvent.click(screen.getByRole('button', { name: '回到今天' }))
    expect(onBackToToday).toHaveBeenCalled()
  })
})
