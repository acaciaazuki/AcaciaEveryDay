import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { toLocalISO } from '../core/date'
import { emptyAppData, type InventoryItem } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { ShoppingPage } from './ShoppingPage'
import { TasksPage } from './TasksPage'
import { TodayPage } from './TodayPage'

const inv = (p: Partial<InventoryItem>): InventoryItem => ({
  id: 'i1',
  name: '衛生紙',
  cat: 'home',
  unit: '包',
  stock: 1,
  minStock: 4,
  lastReplaced: '',
  cycleDays: 0,
  expiry: '',
  openedDate: '',
  paoMonths: 0,
  note: '',
  ...p,
})

describe('庫存不足 → 稍後辦提醒 → 購物清單打勾自動入庫', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState({ ...emptyAppData(), inventory: [inv({}), inv({ id: 'i2', name: '洗碗精', unit: '瓶', stock: 1, minStock: 1 })], inventorySeeded: true })
  })

  it('稍後辦顯示低於安全庫存的用品（等於安全庫存不顯示），可直接加入購物清單並標示已在清單', () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>)
    const section = screen.getByRole('region', { name: /庫存不足，記得安排採購/ })
    expect(within(section).getByText('衛生紙')).toBeInTheDocument()
    expect(within(section).queryByText('洗碗精')).toBeNull()
    expect(within(section).getByText('庫存 1 包 · 安全庫存 4 包 · 還差 3 包')).toBeInTheDocument()
    fireEvent.click(within(section).getByRole('button', { name: '＋ 加入購物清單（3 包）' }))
    expect(useAppStore.getState().shopping[0]).toMatchObject({ title: '衛生紙', quantity: 3, done: false, date: toLocalISO() })
    expect(within(section).getByText('已在購物清單（3 包）')).toBeInTheDocument()
    expect(within(section).getByRole('link', { name: '前往購物清單' })).toHaveAttribute('href', `/shopping?open=${useAppStore.getState().shopping[0]!.id}`)
    // 不另外存成待辦
    expect(useAppStore.getState().tasks).toHaveLength(0)
  })

  it('在購物清單打勾後自動入庫並跳出提示，稍後辦提醒消失；取消打勾扣回', () => {
    useAppStore.getState().addInventoryToShopping('i1', toLocalISO(), '10:00')
    const { unmount } = render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
    fireEvent.click(screen.getByLabelText('標記為已購'))
    expect(useAppStore.getState().inventory[0]!.stock).toBe(4)
    expect(screen.getByRole('status')).toHaveTextContent('已補進庫存：衛生紙 +3 包')
    unmount()

    const tasks = render(<MemoryRouter><TasksPage /></MemoryRouter>)
    expect(screen.queryByRole('region', { name: /庫存不足/ })).toBeNull()
    tasks.unmount()

    render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
    fireEvent.click(screen.getByLabelText('標記為待購'))
    expect(useAppStore.getState().inventory[0]!.stock).toBe(1)
    expect(screen.getByRole('status')).toHaveTextContent('已取消打勾，庫存扣回：衛生紙 −3 包')
  })

  it('今天頁的稍後辦卡片顯示庫存不足筆數', () => {
    render(<MemoryRouter><TodayPage /></MemoryRouter>)
    expect(screen.getByRole('link', { name: '1 項用品庫存不足，記得安排採購' })).toHaveAttribute('href', '/tasks')
  })
})
