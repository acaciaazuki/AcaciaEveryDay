import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { loadSeed } from '../test/spacesSeed'
import { CalendarPage } from './CalendarPage'

const renderPage = () => render(<MemoryRouter><CalendarPage /></MemoryRouter>)

describe('行事曆頂部工具列', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
    loadSeed()
  })

  it('頂部工具列：標題與其他頁 PageHead 主標題同字級，按鈕、空間篩選、檢視身份用較大的字級（跟著字體設定縮放）', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: '行事曆' })).toHaveClass('text-2xl')
    for (const name of ['國定假日', '批次新增', '＋ 新增事件']) expect(screen.getByRole('button', { name })).toHaveClass('px-5', 'py-3', 'text-[length:calc(14px*var(--fs))]', 'whitespace-nowrap')
    const tabs = screen.getByRole('tablist', { name: '顯示哪些行程' })
    for (const tab of within(tabs).getAllByRole('tab')) expect(tab).toHaveClass('text-[length:calc(14px*var(--fs))]')
    expect(screen.getByLabelText('檢視身份')).toHaveClass('text-[length:calc(14px*var(--fs))]')
  })

  it('桌面滿版：週列依當月週數平均分配高度，格子內容不撐開列高', () => {
    renderPage()
    const grid = screen.getByRole('grid')
    const now = new Date()
    const offset = new Date(now.getFullYear(), now.getMonth(), 1).getDay()
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    expect(grid).toHaveAttribute('data-weeks', String(Math.ceil((offset + days) / 7)))
    expect(grid.style.getPropertyValue('--weeks')).toBe(String(Math.ceil((offset + days) / 7)))
    expect(grid).toHaveClass('min-[1001px]:flex-1', 'min-[1001px]:grid-rows-[auto_repeat(var(--weeks),minmax(4.5rem,1fr))]')
    expect(grid.closest('section')).toHaveClass('min-[1001px]:flex-1', 'min-[1001px]:min-h-0')
    for (const cell of screen.getAllByRole('gridcell')) expect(cell).toHaveClass('min-[1001px]:[contain:size]', 'min-[1001px]:min-h-0!')
    // 手機與平板維持原本的自然高度
    expect(screen.getAllByRole('gridcell')[0]).toHaveClass('min-h-20', 'sm:min-h-36')
  })
})
