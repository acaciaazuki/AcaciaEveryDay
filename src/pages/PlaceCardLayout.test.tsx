import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyAppData, type Place } from '../core/schema'
import i18n from '../i18n'
import { useAppStore } from '../store/useAppStore'
import { PlacesPage } from './PlacesPage'

const place = (id: string, patch: Partial<Place> = {}): Place => ({ id, name: id, cat: 'other', address: '', hours: '', note: '', url: '', ...patch })
const renderPage = () => render(<MemoryRouter><PlacesPage /></MemoryRouter>)
const cardOf = (name: string) => screen.getByText(name, { selector: 'strong' }).closest('li')!

describe('最愛地點卡片：精簡排版', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState({ ...emptyAppData(), places: [place('82號豆花', { cat: 'dessert', hours: '星期一: 休息' }), place('第五市場', { cat: 'market', hours: '星期一: 07:00 – 13:00' })] })
  })
  afterEach(() => vi.useRealTimers())

  it('種類、營業狀態與「編輯」在同一列，「編輯」靠右；窄螢幕可以換行', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 23, 12, 0)) // 星期一中午
    renderPage()
    fireEvent.click(screen.getByRole('radio', { name: '今日營業' }))
    const row = cardOf('82號豆花').querySelector('[data-place-meta]')!
    expect(row).toHaveClass('flex', 'flex-wrap', 'items-center')
    const parts = [...row.children].map((el) => el.textContent)
    expect(parts).toEqual(['甜點', '今日公休', '編輯'])
    expect(within(row as HTMLElement).getByRole('button', { name: '編輯' })).toHaveClass('ml-auto', 'shrink-0')
    expect(within(cardOf('第五市場').querySelector('[data-place-meta]') as HTMLElement).getByText('營業中')).toBeInTheDocument()
  })

  it('沒有營業狀態時，種類與「編輯」同一列', () => {
    renderPage()
    const row = cardOf('82號豆花').querySelector('[data-place-meta]')!
    expect([...row.children].map((el) => el.textContent)).toEqual(['甜點', '編輯'])
  })

  it('底部只剩滿版的 Google Maps；點「編輯」照常打開編輯對話框', () => {
    renderPage()
    const card = cardOf('82號豆花')
    const maps = within(card).getByRole('link', { name: /Google Maps/ })
    expect(maps).toHaveClass('block', 'w-full')
    expect(maps.parentElement).toBe(card)
    expect(within(card).getAllByRole('button', { name: '編輯' })).toHaveLength(1)
    fireEvent.click(within(card).getByRole('button', { name: '編輯' }))
    expect(within(screen.getByRole('dialog')).getByDisplayValue('82號豆花')).toBeInTheDocument()
  })
})
