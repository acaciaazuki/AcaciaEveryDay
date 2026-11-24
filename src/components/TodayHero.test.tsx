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

describe('今天頁的問候與摘要橫幅', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
  })

  it('同一張橫幅裡有：日期切換、天氣插畫、大字問候（h1）、鼓勵文字、三格摘要、操作按鈕', () => {
    setup()
    const hero = screen.getByRole('region', { name: '晚安' })
    expect(hero).toHaveAttribute('data-page-head')
    expect(within(hero).getByRole('group', { name: '切換日期' })).toHaveTextContent('2026年11月24日 星期二')
    expect(within(hero).getByRole('heading', { level: 1, name: '晚安' })).toHaveClass('text-[length:calc(30px*var(--fs))]')
    expect(hero.querySelector('svg[data-weather="day"]')).not.toBeNull()
    expect(within(hero).getByRole('heading', { level: 2, name: '慢慢來，一切都會剛剛好。' })).toBeInTheDocument()
    expect(within(hero).getByText('你有幾件重要的事，還有足夠的空檔好好呼吸。')).toBeInTheDocument()
    const stats = within(within(hero).getByRole('list', { name: '今天的摘要' })).getAllByRole('listitem')
    expect(stats.map((li) => li.textContent)).toEqual(['3個行程', '2個待辦', '15.8h自由時間'])
    expect(within(hero).getByRole('button', { name: '＋ 新增安排' })).toBeInTheDocument()
  })

  it('晚上插畫換成月亮', () => {
    setup({ night: true })
    expect(document.querySelector('svg[data-weather="night"]')).not.toBeNull()
  })

  it('三種寬度的排法：手機直向（含按鈕）、中屏單欄、桌機一列；681px 以上按鈕改用側邊欄', () => {
    setup()
    const hero = screen.getByRole('region', { name: '晚安' })
    const [greet, divider, message, stats, actions] = [...hero.children] as HTMLElement[]
    expect(greet).toHaveAttribute('data-hero-greet')
    expect(message).toHaveAttribute('data-hero-message')
    expect(actions).toHaveAttribute('data-hero-actions')
    // 中屏：單欄，問候 → 文字 → 摘要；側邊欄已有新增與行事曆，橫幅不放按鈕，避免重複
    expect(hero.className).not.toMatch(/min-\[681px\]:grid-cols-/)
    expect(actions).toHaveClass('min-[681px]:hidden')
    expect(actions.className).not.toMatch(/min-\[1280px\]/)
    expect(stats).toHaveClass('min-[681px]:col-[1/-1]')
    // 桌機：問候｜分隔線｜文字｜數字卡，按鈕收起
    expect(hero).toHaveClass('min-[1280px]:grid-cols-[auto_1px_minmax(0,1fr)_auto]')
    expect(divider).toHaveClass('hidden', 'min-[1280px]:block')
    expect(message).toHaveClass('min-[1280px]:col-[3]')
    expect(stats).toHaveClass('min-[1280px]:col-[4]')
    // 手機：天氣插畫排在日期之前
    expect(greet.querySelector('svg')).toHaveClass('-order-1')
  })

  it('‹ 日期 › 是不換行的一組', () => {
    setup()
    const trio = screen.getByRole('button', { name: '往前' }).parentElement!
    expect(trio).toHaveClass('whitespace-nowrap')
    expect(trio).toHaveTextContent('2026年11月24日 星期二')
    expect(within(trio).getByRole('button', { name: '往後' })).toBeInTheDocument()
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
