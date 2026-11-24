import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { CalendarPage } from './CalendarPage'
import { InventoryPage } from './InventoryPage'
import { PlacesPage } from './PlacesPage'
import { RemindersPage } from './RemindersPage'
import { ShoppingPage } from './ShoppingPage'
import { SubscriptionsPage } from './SubscriptionsPage'
import { TasksPage } from './TasksPage'
import { TodayPage } from './TodayPage'

// 以行事曆「＋ 新增事件」為基準的尺寸與字級（字級跟著「設定 → 字體大小」縮放）
const PAGE_ACTION = ['px-5', 'py-3', 'text-[length:calc(14px*var(--fs))]', 'whitespace-nowrap']

const PAGES: [string, ComponentType, string[]][] = [
  ['行事曆', CalendarPage, ['＋ 新增事件', '國定假日', '批次新增']],
  ['今天', TodayPage, ['＋ 新增安排']],
  ['最愛地點', PlacesPage, ['＋ 新增地點']],
  ['稍後辦', TasksPage, ['＋ 新增待辦']],
  ['購物清單與記帳本', ShoppingPage, ['＋ 新增記帳']],
  ['防遺漏提醒', RemindersPage, ['＋ 新增']],
  ['庫存與提醒', InventoryPage, ['＋ 新增用品']],
  ['訂閱與續費', SubscriptionsPage, ['＋ 新增訂閱']],
]

describe('各頁右上角主按鈕尺寸統一', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
  })

  it.each(PAGES)('%s：右上角按鈕跟行事曆「＋ 新增事件」一樣大、不折行', (_, Page, names) => {
    render(<MemoryRouter><Page /></MemoryRouter>)
    const head = screen.getByRole('heading', { level: 1 }).closest('div')!.parentElement!
    for (const name of names) {
      const btn = [...head.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)
      expect(btn, name).toBeTruthy()
      expect(btn).toHaveClass(...PAGE_ACTION)
    }
  })

  it('記帳本的「批次加入固定支出」次要按鈕與主按鈕同高', () => {
    render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
    const head = screen.getByRole('heading', { level: 1 }).closest('div')!.parentElement!
    const buttons = [...head.querySelectorAll('button')]
    expect(buttons.length).toBeGreaterThanOrEqual(2)
    for (const b of buttons) expect(b).toHaveClass(...PAGE_ACTION)
  })

  it('行事曆主標題與其他頁 PageHead 主標題同字級', () => {
    const { unmount } = render(<MemoryRouter><PlacesPage /></MemoryRouter>)
    const places = screen.getByRole('heading', { level: 1 }).className
    unmount()
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1 }).className).toBe(places)
  })
})
