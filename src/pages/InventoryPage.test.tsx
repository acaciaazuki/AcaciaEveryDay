import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyAppData } from '../core/schema'
import i18n from '../i18n'
import { useAppStore } from '../store/useAppStore'
import { InventoryPage } from './InventoryPage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <InventoryPage />
    </MemoryRouter>,
  )
const list = () => screen.getByRole('list', { name: '用品清單' })
const cardOf = (name: string) => within(list()).getByText(name).closest('li')!

describe('庫存與提醒頁', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
  })
  afterEach(() => vi.restoreAllMocks())

  it('第一次進入帶入 4 筆範例，不更新 updatedAt，儀表板顯示統計', () => {
    renderPage()
    const s = useAppStore.getState()
    expect(s.inventory).toHaveLength(4)
    expect(s.inventorySeeded).toBe(true)
    expect(s.updatedAt).toBe(0)
    for (const n of ['洗碗海綿', '牙刷', '抽取式衛生紙', '沐浴乳']) expect(within(list()).getByText(n)).toBeInTheDocument()
    expect(within(cardOf('牙刷')).getAllByText('已逾期 5 天').length).toBeGreaterThan(0)
    // 即期 3 項、待補貨 2 項、總數 4 項
    const board = screen.getByRole('heading', { name: '慢慢來，一切都會剛剛好' }).closest('section')!
    expect(within(board).getByText('3 項')).toBeInTheDocument()
    expect(within(board).getByText('2 項')).toBeInTheDocument()
    expect(within(board).getByText('4 項')).toBeInTheDocument()
  })

  it('加入購物清單：寫入建議數量、跳出提示、按鈕變成已在購物清單中，不會重複加入', () => {
    renderPage()
    fireEvent.click(within(cardOf('抽取式衛生紙')).getByRole('button', { name: /加入購物清單/ }))
    const { shopping, inventory } = useAppStore.getState()
    expect(shopping).toHaveLength(1)
    expect(shopping[0]).toMatchObject({ title: '抽取式衛生紙', quantity: 2, amt: 0, cat: 'housing', done: false, currency: 'TWD' })
    expect(inventory.find((x) => x.name === '抽取式衛生紙')?.shoppingId).toBe(shopping[0]!.id)
    expect(screen.getByRole('status')).toHaveTextContent('已加入購物清單：抽取式衛生紙 × 2 包')
    expect(within(cardOf('抽取式衛生紙')).getByText(/已在購物清單中/)).toBeInTheDocument()
    expect(within(cardOf('抽取式衛生紙')).queryByRole('button', { name: /加入購物清單/ })).toBeNull()
    expect(useAppStore.getState().addInventoryToShopping(inventory.find((x) => x.name === '抽取式衛生紙')!.id, '2026-11-22', '12:00')).toBe(0)
  })

  it('購物清單打勾後自動補進庫存，用品卡回到可再加入購物清單', () => {
    renderPage()
    fireEvent.click(within(cardOf('抽取式衛生紙')).getByRole('button', { name: /加入購物清單/ }))
    act(() => {
      useAppStore.getState().toggleExpense(useAppStore.getState().shopping[0]!.id)
    })
    const x = useAppStore.getState().inventory.find((i) => i.name === '抽取式衛生紙')!
    expect(x.stock).toBe(4)
    expect(x.shoppingId).toBeUndefined()
    expect(within(cardOf('抽取式衛生紙')).getByText('庫存充足')).toBeInTheDocument()
    expect(within(cardOf('抽取式衛生紙')).queryByRole('button', { name: /已買到/ })).toBeNull()
  })

  it('舊資料（自動入庫前就打勾的）仍可一鍵補進庫存，且只補一次', () => {
    renderPage()
    fireEvent.click(within(cardOf('抽取式衛生紙')).getByRole('button', { name: /加入購物清單/ }))
    act(() => {
      useAppStore.setState((st) => ({ shopping: st.shopping.map((e) => ({ ...e, done: true })) }))
    })
    fireEvent.click(within(cardOf('抽取式衛生紙')).getByRole('button', { name: /已買到，補進庫存 \+2/ }))
    const { inventory, shopping } = useAppStore.getState()
    const x = inventory.find((i) => i.name === '抽取式衛生紙')!
    expect(x.stock).toBe(4)
    expect(x.shoppingId).toBeUndefined()
    expect(shopping[0]).toMatchObject({ stockedItemId: x.id, stockedQty: 2 })
    // 之後取消打勾會扣回
    act(() => {
      useAppStore.getState().toggleExpense(shopping[0]!.id)
    })
    expect(useAppStore.getState().inventory.find((i) => i.name === '抽取式衛生紙')!.stock).toBe(2)
  })

  it('使用 -1／補充 +1 會更新庫存，今天已更換會重設倒數', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '牙刷 使用 -1' }))
    fireEvent.click(screen.getByRole('button', { name: '沐浴乳 補充 +1' }))
    const get = (n: string) => useAppStore.getState().inventory.find((x) => x.name === n)!
    expect(get('牙刷').stock).toBe(2)
    expect(get('沐浴乳').stock).toBe(3)
    fireEvent.click(within(cardOf('牙刷')).getByRole('button', { name: '今天已更換' }))
    expect(within(cardOf('牙刷')).queryByText(/已逾期/)).toBeNull()
  })

  it('分頁篩選與搜尋', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^需補貨/ }))
    expect(within(list()).queryByText('牙刷')).toBeNull()
    expect(within(list()).getByText('洗碗海綿')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^全部/ }))
    fireEvent.change(screen.getByLabelText('搜尋用品'), { target: { value: '廚房' } })
    expect(within(list()).getAllByRole('listitem').filter((li) => li.parentElement === list())).toHaveLength(1)
    expect(within(list()).getByText('洗碗海綿')).toBeInTheDocument()
  })

  it('新增用品', () => {
    useAppStore.setState({ inventorySeeded: true })
    renderPage()
    fireEvent.click(screen.getByText('＋ 新增用品'))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('用品名稱'), { target: { value: '洗碗精' } })
    fireEvent.change(within(dialog).getByLabelText('目前庫存'), { target: { value: '0' } })
    fireEvent.change(within(dialog).getByLabelText('安全庫存'), { target: { value: '1' } })
    fireEvent.change(within(dialog).getByLabelText('更換週期（天）'), { target: { value: '60' } })
    fireEvent.click(within(dialog).getByText('儲存'))
    expect(useAppStore.getState().inventory[0]).toMatchObject({ name: '洗碗精', stock: 0, minStock: 1, cycleDays: 60 })
    expect(within(cardOf('洗碗精')).getByText('待補貨')).toBeInTheDocument()
  })
})
