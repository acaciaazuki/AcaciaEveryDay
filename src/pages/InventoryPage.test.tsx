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

describe('庫存分類：新增、刪除、排序', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState({ ...emptyAppData(), inventorySeeded: true })
  })
  afterEach(() => vi.restoreAllMocks())

  const openNew = () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '＋ 新增用品' }))
    return screen.getByRole('dialog')
  }
  const pickCat = (dialog: HTMLElement, label: string) => {
    fireEvent.click(within(dialog).getByRole('combobox', { name: '分類' }))
    fireEvent.click(within(dialog).getByRole('option', { name: label }))
  }

  it('分類選單有低溫食材與常溫食材', () => {
    const d = openNew()
    fireEvent.click(within(d).getByRole('combobox', { name: '分類' }))
    expect(within(d).getByRole('option', { name: '低溫食材' })).toBeInTheDocument()
    expect(within(d).getByRole('option', { name: '常溫食材' })).toBeInTheDocument()
  })

  it('選「其他」才出現自訂分類；新增後自動選取並存進用品，重複與空白會提示', () => {
    const d = openNew()
    expect(within(d).queryByLabelText('自訂分類')).toBeNull()
    pickCat(d, '其他')
    const input = within(d).getByLabelText('自訂分類')
    fireEvent.click(within(d).getByRole('button', { name: '新增' }))
    expect(within(d).getByText('請輸入分類名稱')).toBeInTheDocument()
    fireEvent.change(input, { target: { value: '廚房耗材' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(within(d).getByText('已經有同名的分類了')).toBeInTheDocument()
    fireEvent.change(input, { target: { value: '寵物用品' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    const custom = useAppStore.getState().invCats.custom
    expect(custom).toHaveLength(1)
    expect(within(d).getByRole('combobox', { name: '分類' })).toHaveTextContent('寵物用品')
    fireEvent.change(within(d).getByLabelText('用品名稱'), { target: { value: '貓砂' } })
    fireEvent.click(within(d).getByRole('button', { name: '儲存' }))
    expect(useAppStore.getState().inventory[0]).toMatchObject({ name: '貓砂', cat: custom[0]!.id })
    expect(within(list()).getByText('寵物用品')).toBeInTheDocument()
  })

  it('刪除自訂分類先確認，用品改歸「其他」；取消就不刪', () => {
    useAppStore.getState().addInvCategory('寵物用品')
    const id = useAppStore.getState().invCats.custom[0]!.id
    useAppStore.getState().addInventory({ name: '貓砂', cat: id, unit: '', stock: 1, minStock: 1, lastReplaced: '', cycleDays: 0, expiry: '', openedDate: '', paoMonths: 0, note: '' })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '分類設定' }))
    const d = screen.getByRole('dialog', { name: '分類設定' })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    fireEvent.click(within(d).getByRole('button', { name: '刪除分類「寵物用品」' }))
    expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining('1 個用品'))
    expect(useAppStore.getState().invCats.custom).toHaveLength(1)
    fireEvent.click(within(d).getByRole('button', { name: '刪除分類「寵物用品」' }))
    expect(useAppStore.getState().invCats.custom).toHaveLength(0)
    expect(useAppStore.getState().inventory[0]!.cat).toBe('other')
  })

  it('分類設定可以上下移動排序並恢復預設，新增用品的選單跟著變', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '分類設定' }))
    const d = screen.getByRole('dialog', { name: '分類設定' })
    expect(within(d).getByRole('button', { name: '恢復預設順序' })).toBeDisabled()
    fireEvent.click(within(d).getByRole('button', { name: '上移「低溫食材」' }))
    const order = useAppStore.getState().invCats.order
    expect(order.indexOf('chilled')).toBeLessThan(order.indexOf('kitchen'))
    fireEvent.click(within(d).getByRole('button', { name: '恢復預設順序' }))
    expect(useAppStore.getState().invCats.order).toEqual([])
  })

  it('依分類篩選：下拉選單列出所有分類（含自訂、空的分類）與數量，依使用者排序', () => {
    const base = { unit: '', stock: 5, minStock: 1, lastReplaced: '', cycleDays: 0, expiry: '', openedDate: '', paoMonths: 0, note: '' }
    useAppStore.setState({ inventorySeeded: true })
    const pet = useAppStore.getState().addInvCategory('寵物用品')
    useAppStore.getState().addInventory({ ...base, name: '冷凍水餃', cat: 'chilled' })
    useAppStore.getState().addInventory({ ...base, name: '米', cat: 'pantry' })
    useAppStore.getState().addInventory({ ...base, name: '貓砂', cat: pet })
    renderPage()
    const box = screen.getByRole('combobox', { name: '依分類篩選' })
    expect(box).toHaveTextContent('所有分類')
    fireEvent.click(box)
    const opts = within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)
    expect(opts[0]).toBe('所有分類3')
    expect(opts).toContain('低溫食材1')
    expect(opts).toContain('廚房耗材0')
    expect(opts).toContain('寵物用品1')
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /低溫食材/ }))
    expect(within(list()).getByText('冷凍水餃')).toBeInTheDocument()
    expect(within(list()).queryByText('米')).toBeNull()
    fireEvent.click(box)
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /寵物用品/ }))
    expect(within(list()).getByText('貓砂')).toBeInTheDocument()
    expect(within(list()).queryByText('冷凍水餃')).toBeNull()
    fireEvent.click(box)
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /所有分類/ }))
    expect(within(list()).getByText('米')).toBeInTheDocument()
  })
})

describe('用品單位', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState({ ...emptyAppData(), inventorySeeded: true })
  })

  const openNew = () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '＋ 新增用品' }))
    return screen.getByRole('dialog')
  }

  it('從選單挑常用單位', () => {
    const d = openNew()
    fireEvent.change(within(d).getByLabelText('用品名稱'), { target: { value: '洗碗精' } })
    fireEvent.change(within(d).getByRole('combobox', { name: '單位' }), { target: { value: '瓶' } })
    expect(within(d).queryByLabelText('自訂單位')).toBeNull()
    fireEvent.click(within(d).getByRole('button', { name: '儲存' }))
    expect(useAppStore.getState().inventory[0]).toMatchObject({ name: '洗碗精', unit: '瓶' })
  })

  it('選「其他…」可以自己輸入單位，之後會出現在選單裡', () => {
    const d = openNew()
    fireEvent.change(within(d).getByLabelText('用品名稱'), { target: { value: '鮪魚罐頭' } })
    fireEvent.change(within(d).getByRole('combobox', { name: '單位' }), { target: { value: '__custom__' } })
    const input = within(d).getByLabelText('自訂單位')
    fireEvent.change(input, { target: { value: ' 罐 ' } })
    fireEvent.click(within(d).getByRole('button', { name: '儲存' }))
    expect(useAppStore.getState().inventory[0]).toMatchObject({ name: '鮪魚罐頭', unit: '罐' })
    expect(within(cardOf('鮪魚罐頭')).getByText(/罐 · 安全庫存/)).toBeInTheDocument()

    // 再新增一項：用過的自訂單位直接在選單裡
    fireEvent.click(screen.getByRole('button', { name: '＋ 新增用品' }))
    const d2 = screen.getByRole('dialog')
    const select = within(d2).getByRole('combobox', { name: '單位' })
    expect(within(select).getByRole('option', { name: '罐' })).toBeInTheDocument()
    expect(within(select).getAllByRole('option').at(-1)).toHaveTextContent('其他…')
  })

  it('編輯自訂單位的用品時，選單顯示原本的單位', () => {
    useAppStore.getState().addInventory({ name: '麵粉', cat: 'pantry', unit: '公斤', stock: 1, minStock: 1, lastReplaced: '', cycleDays: 0, expiry: '', openedDate: '', paoMonths: 0, note: '' })
    renderPage()
    fireEvent.click(within(list()).getByText('麵粉'))
    expect(within(screen.getByRole('dialog')).getByRole('combobox', { name: '單位' })).toHaveValue('公斤')
  })
})
