import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { migrate } from '../core/migrate'
import { emptyAppData } from '../core/schema'
import { useFontScale } from '../hooks/useFontScale'
import { useAppStore } from '../store/useAppStore'
import { SettingsPage } from './SettingsPage'
import { ShoppingPage } from './ShoppingPage'
import { SubscriptionsPage } from './SubscriptionsPage'

function Harness() {
  useFontScale()
  return <SettingsPage />
}

describe('字體大小', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
    document.documentElement.style.removeProperty('--fs')
    localStorage.clear()
  })

  it('預設標準，點選後即時生效並存進資料', () => {
    render(<MemoryRouter><Harness /></MemoryRouter>)
    const group = screen.getByRole('radiogroup', { name: '字體大小' })
    expect(within(group).getAllByRole('radio').map((r) => r.textContent?.replace('', '').replace('Aa', ''))).toEqual(['小', '標準', '大', '特大'])
    expect(within(group).getByRole('radio', { name: /標準/ })).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement.style.getPropertyValue('--fs')).toBe('1')

    fireEvent.click(within(group).getByRole('radio', { name: /特大/ }))
    expect(within(group).getByRole('radio', { name: /特大/ })).toHaveAttribute('aria-checked', 'true')
    expect(within(group).getByRole('radio', { name: /標準/ })).toHaveAttribute('aria-checked', 'false')
    expect(useAppStore.getState().settings.fontSize).toBe('xl')
    expect(document.documentElement.style.getPropertyValue('--fs')).toBe('1.3')
    expect(localStorage.getItem('acacia_font_size')).toBe('xl')
    expect(useAppStore.getState().exportData().settings).toEqual({ fontSize: 'xl', currency: 'TWD' })

    fireEvent.click(within(group).getByRole('radio', { name: /^小/ }))
    expect(document.documentElement.style.getPropertyValue('--fs')).toBe('0.9')
  })

  it('舊資料沒有 settings 時補標準，雲端資料的字體大小會被讀進來', () => {
    const { settings: _drop, ...old } = emptyAppData()
    void _drop
    expect(migrate(old).settings).toEqual({ fontSize: 'md', currency: 'TWD' })
    expect(migrate({ ...emptyAppData(), settings: { fontSize: 'lg' } }).settings.fontSize).toBe('lg')
  })
})

describe('預設貨幣', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
  })

  it('預設新台幣，切換後存進設定並跟著同步資料匯出', () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    const group = screen.getByRole('radiogroup', { name: '預設貨幣' })
    expect(within(group).getAllByRole('radio')).toHaveLength(8)
    expect(within(group).getByRole('radio', { name: /^TWD/ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(within(group).getByRole('radio', { name: /^JPY/ }))
    expect(within(group).getByRole('radio', { name: /^JPY/ })).toHaveAttribute('aria-checked', 'true')
    expect(useAppStore.getState().exportData().settings.currency).toBe('JPY')
    expect(useAppStore.getState().updatedAt).toBeGreaterThan(0)
  })

  it('記帳金額與輸入框標籤改用預設貨幣（只換符號、不換算）', () => {
    useAppStore.setState({
      settings: { fontSize: 'md', currency: 'USD' },
      shopping: [{ id: 'a', title: '咖啡', amt: 4.5, store: '', cat: 'food', date: new Date().toISOString().slice(0, 10), time: '12:00', done: false }],
    })
    render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
    expect(screen.getAllByText('US$4.5').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('＋ 新增記帳'))
    expect(screen.getByLabelText('總金額（US$）')).toBeInTheDocument()
    expect(screen.getByLabelText('單價（US$）')).toBeInTheDocument()
  })

  it('新增訂閱預先帶入預設貨幣，已存的訂閱保留原幣別', () => {
    useAppStore.setState({
      settings: { fontSize: 'md', currency: 'EUR' },
      subscriptionsSeeded: true,
      subscriptions: [{ id: 's1', name: 'Old', plan: '', cat: 'tools', cycle: 'monthly', amount: 100, currency: 'TWD', nextDate: '', payment: '', status: 'active', note: '' }],
    })
    render(<MemoryRouter><SubscriptionsPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('＋ 新增訂閱'))
    const dialog = screen.getByRole('dialog')
    expect((within(dialog).getByLabelText('幣別') as HTMLSelectElement).value).toBe('EUR')
    expect(within(dialog).getByLabelText('金額（€）')).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('服務名稱'), { target: { value: 'Spotify' } })
    fireEvent.change(within(dialog).getByLabelText('金額（€）'), { target: { value: '9.99' } })
    fireEvent.click(within(dialog).getByText('儲存'))
    const subs = useAppStore.getState().subscriptions
    expect(subs.find((x) => x.name === 'Spotify')?.currency).toBe('EUR')
    expect(subs.find((x) => x.id === 's1')?.currency).toBe('TWD')
  })

  it('舊資料沒有 currency 時補 TWD', () => {
    expect(migrate({ ...emptyAppData(), settings: { fontSize: 'lg' } }).settings).toEqual({ fontSize: 'lg', currency: 'TWD' })
    const merge = useAppStore.persist.getOptions().merge!
    expect((merge({ settings: { fontSize: 'lg' } }, useAppStore.getState()) as { settings: object }).settings).toEqual({ fontSize: 'lg', currency: 'TWD' })
  })
})

describe('設定頁區塊順序', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
  })

  it('共享空間在雲端同步正下方，字體大小在刪除所有資料正上方', () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent?.trim() ?? '')
    const at = (name: string) => {
      const i = titles.findIndex((x) => x.endsWith(name))
      expect(i, name).toBeGreaterThanOrEqual(0)
      return i
    }
    expect(at('共享空間')).toBe(at('雲端同步') + 1)
    expect(at('字體大小')).toBe(at('刪除所有資料') - 1)
  })
})
