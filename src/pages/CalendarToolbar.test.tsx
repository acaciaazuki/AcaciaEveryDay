import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { CalendarPage } from './CalendarPage'

const renderPage = () => render(<MemoryRouter><CalendarPage /></MemoryRouter>)

describe('行事曆頂部工具列', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
  })

  it('頂部工具列：標題與其他頁 PageHead 主標題同字級，按鈕用較大的字級（跟著字體設定縮放）', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: '行事曆' })).toHaveClass('text-[length:calc(13px*var(--fs))]')
    for (const name of ['國定假日', '批次新增', '＋ 新增事件']) expect(screen.getByRole('button', { name })).toHaveClass('px-5', 'py-3', 'text-[length:calc(14px*var(--fs))]', 'whitespace-nowrap')
  })

  it('手機、平板、桌面都滿版：週列依當月週數平均分配高度，格子內容不撐開列高', () => {
    renderPage()
    const grid = screen.getByRole('grid')
    const now = new Date()
    const offset = new Date(now.getFullYear(), now.getMonth(), 1).getDay()
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    expect(grid).toHaveAttribute('data-weeks', String(Math.ceil((offset + days) / 7)))
    expect(grid.style.getPropertyValue('--weeks')).toBe(String(Math.ceil((offset + days) / 7)))
    // 手機、平板、桌面都撐滿：不分寬度都是 flex-1，週列 1fr 平均分配
    expect(grid).toHaveClass('flex-1', 'grid-rows-[auto_repeat(var(--weeks),minmax(var(--row-min),1fr))]')
    // 每列最小高度：手機 3.25rem、平板 5rem、桌面 4.5rem
    expect(grid).toHaveClass('[--row-min:3.25rem]', 'min-[640px]:[--row-min:5rem]', 'min-[1001px]:[--row-min:4.5rem]!')
    expect(grid.closest('section')).toHaveClass('flex', 'flex-1', 'min-h-0')
    expect(grid.closest('section')!.parentElement).toHaveClass('flex', 'flex-1', 'min-h-0', 'flex-col')
    for (const cell of screen.getAllByRole('gridcell')) {
      expect(cell).toHaveClass('[contain:size]', 'min-h-0')
      // 不再用固定的最小高度（原本手機 min-h-20、平板 sm:min-h-36）
      expect(cell).not.toHaveClass('min-h-20', 'sm:min-h-36')
    }
  })
})
