import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { SettingsPage } from './SettingsPage'
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
    // 頁面標頭（PageHead 或今天頁的問候橫幅）都標了 data-page-head
    const head = screen.getByRole('heading', { level: 1 }).closest('[data-page-head]')!
    for (const name of names) {
      const btn = [...head.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)
      expect(btn, name).toBeTruthy()
      expect(btn).toHaveClass(...PAGE_ACTION)
    }
  })

  it('記帳本的「批次加入固定支出」次要按鈕與主按鈕同高', () => {
    render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
    // 頁面標頭（PageHead 或今天頁的問候橫幅）都標了 data-page-head
    const head = screen.getByRole('heading', { level: 1 }).closest('[data-page-head]')!
    // 只看右側操作按鈕；標題旁的本期記帳卡裡的「歸檔本期」是精簡尺寸
    const buttons = [...head.querySelectorAll(':scope > :last-child button')]
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['批次加入固定支出', '＋ 新增記帳'])
    for (const b of buttons) expect(b).toHaveClass(...PAGE_ACTION)
  })

  it('行事曆主標題與其他頁 PageHead 主標題同字級', () => {
    const { unmount } = render(<MemoryRouter><PlacesPage /></MemoryRouter>)
    const places = screen.getByRole('heading', { level: 1 }).className
    unmount()
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1 }).className).toBe(places)
  })

  it.each([...PAGES.map(([name, Page]) => [name, Page] as const), ['設定', SettingsPage] as const])(
    '%s：主標題字級固定（今天頁是大字問候，其他頁 13px），標題上方沒有標語小字',
    (name, Page) => {
      render(<MemoryRouter><Page /></MemoryRouter>)
      const h1 = screen.getByRole('heading', { level: 1 })
      // 今天頁的問候是橫幅主角，用大字（30px，桌機 36px）；其他頁的 PageHead 標題維持 13px
      expect(h1).toHaveClass(name === '今天' ? 'text-[length:calc(30px*var(--fs))]' : 'text-[length:calc(13px*var(--fs))]')
      expect(h1).not.toHaveClass('text-2xl')
      // 今天頁標題上方保留日期切換列（功能列）；其他頁標題區塊只剩標題本身
      if (name === '今天') expect(screen.getByRole('button', { name: '往前' })).toBeInTheDocument()
      else expect(h1.parentElement!.children).toHaveLength(1)
      for (const tagline of ['把重要的事，放進剛好的位置', '不急，但記得要做', '每月 10 日至次月 9 日結算', '搜尋地點自動抓取資訊'])
        expect(document.body.textContent).not.toContain(tagline)
    },
  )
})
