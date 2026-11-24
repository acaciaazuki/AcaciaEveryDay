import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { toLocalISO } from '../core/date'
import { billingPeriod } from '../core/expenses'
import { emptyAppData, type Expense } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { ShoppingPage } from './ShoppingPage'

const ex = (id: string, date: string, amt = 100, currency?: string): Expense => ({ id, title: id, amt, store: '', cat: 'food', date, time: '12:00', done: false, currency })
/** 文字被拆成多個元素時，比對整個元素的 textContent */
const fullText = (text: string) => (_: string, el: Element | null) => el?.textContent === text && [...(el?.children ?? [])].every((c) => c.textContent !== text)

describe('ShoppingPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
  })

  it('新增自訂分類的記帳', () => {
    render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('＋ 新增記帳'))
    fireEvent.change(screen.getByLabelText('購買項目'), { target: { value: '貓砂' } })
    fireEvent.change(screen.getByLabelText('總金額（NT$）'), { target: { value: '300' } })
    fireEvent.click(screen.getByRole('combobox', { name: '分類' }))
    fireEvent.click(screen.getByRole('option', { name: /其他/ }))
    fireEvent.change(screen.getByLabelText('自訂分類名稱'), { target: { value: '寵物' } })
    fireEvent.click(screen.getByText('儲存'))
    expect(useAppStore.getState().shopping[0]).toMatchObject({ title: '貓砂', amt: 300, cat: 'other', customCat: '寵物' })
    expect(screen.getByText(fullText('寵物: NT$300'))).toBeInTheDocument()
  })

  it('數量與單價自動算出總金額，改總金額時單價清空、不互相覆蓋', () => {
    render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('＋ 新增記帳'))
    fireEvent.change(screen.getByLabelText('購買項目'), { target: { value: '雞蛋' } })
    const total = screen.getByLabelText('總金額（NT$）') as HTMLInputElement
    fireEvent.change(screen.getByLabelText('單價（NT$）'), { target: { value: '12.5' } })
    expect(total.value).toBe('12.5')
    fireEvent.change(screen.getByLabelText('數量'), { target: { value: '3' } })
    expect(total.value).toBe('37.5')
    fireEvent.change(screen.getByLabelText('單價（NT$）'), { target: { value: '' } })
    expect(total.value).toBe('37.5')
    fireEvent.change(screen.getByLabelText('單價（NT$）'), { target: { value: '10' } })
    expect(total.value).toBe('30')
    // 手動改總金額：單價清空，之後改數量不會把總金額蓋回去
    fireEvent.change(total, { target: { value: '99' } })
    expect((screen.getByLabelText('單價（NT$）') as HTMLInputElement).value).toBe('')
    fireEvent.change(screen.getByLabelText('數量'), { target: { value: '5' } })
    expect(total.value).toBe('99')
    fireEvent.change(screen.getByLabelText('單價（NT$）'), { target: { value: '20' } })
    expect(total.value).toBe('100')
    fireEvent.click(screen.getByText('儲存'))
    expect(useAppStore.getState().shopping[0]).toMatchObject({ amt: 100, quantity: 5, unitPrice: 20 })
    expect(screen.getByText(/5 × /)).toBeInTheDocument()
  })

  it('沒填單價就維持舊格式，背景色與文字色可分開選', () => {
    render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('＋ 新增記帳'))
    fireEvent.change(screen.getByLabelText('購買項目'), { target: { value: '拿鐵' } })
    fireEvent.change(screen.getByLabelText('總金額（NT$）'), { target: { value: '120' } })
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('radio', { name: '#e6eedc' }))
    fireEvent.click(within(dialog).getByRole('radio', { name: '橄欖棕' }))
    fireEvent.click(screen.getByText('儲存'))
    const saved = useAppStore.getState().shopping[0]
    expect(saved).toMatchObject({ amt: 120, bgColor: '#e6eedc', titleColor: '#5b5530' })
    expect(saved.quantity).toBeUndefined()
    expect(saved.unitPrice).toBeUndefined()
    expect(screen.getByText('拿鐵').closest('li')).toHaveStyle({ background: '#e6eedc', color: '#5b5530' })
  })

  it('舊記帳（沒有數量單價）照常顯示，且保留分類文字色', () => {
    useAppStore.setState({
      shopping: [{ id: 'o', title: '舊午餐', amt: 80, store: '', cat: 'food', date: '2026-11-10', time: '12:00', done: false, titleColor: '#263633', bgColor: '#ffffff' }],
    })
    render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
    expect(screen.getByText('舊午餐').closest('li')).toHaveStyle({ color: '#c62828' })
    expect(screen.queryByText(/ × /)).not.toBeInTheDocument()
  })

  it('已結束週期的記帳自動收進年度記帳本，並可切換年份查看', () => {
    useAppStore.setState({
      shopping: [ex('今年舊帳', '2026-08-20', 300), ex('去年帳', '2025-12-15', 500), ex('跨年帳', '2026-01-05', 200), ex('這期午餐', toLocalISO(), 80)],
    })
    render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
    const s = useAppStore.getState()
    expect(s.shopping.map((e) => e.id)).toEqual(['這期午餐'])
    expect(s.archives.map((a) => a.start)).toEqual(['2026-08-10', '2025-12-10'])
    // 2026-01-05 屬於 2025-12-10 開始的那一期，歸 2025 年
    expect(screen.getByText('2026 年記帳本')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '2025' }))
    expect(screen.getByText('2025 年記帳本')).toBeInTheDocument()
    expect(screen.getByText(fullText('共 1 期 · NT$700'))).toBeInTheDocument()
    expect(screen.getByText('2025-12-10 – 2026-01-09')).toBeInTheDocument()
  })

  it('頂部同一行：標題 → 本期記帳 → 預算進度 → 批次加入固定支出、＋ 新增記帳', () => {
    useAppStore.setState({ shopping: [ex('午餐', toLocalISO(), 120)] })
    render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
    const head = screen.getByRole('heading', { level: 1 }).closest('[data-page-head]') as HTMLElement
    expect(head).toHaveClass('flex', 'flex-wrap', 'items-center', 'justify-between')
    const [title, aside, actions] = [...head.children] as HTMLElement[]
    expect(title).toHaveTextContent('購物清單')
    // 中間撐滿、可縮小，不擠壓右側按鈕；1279px 以下移到第二行
    expect(aside).toHaveClass('min-w-0', 'order-last', 'w-full', 'min-[1280px]:order-none', 'min-[1280px]:flex-1')
    const period = within(aside).getByRole('region', { name: /^本期/ })
    expect(within(period).getByTestId('period-total')).toHaveTextContent('120')
    expect(within(period).getByRole('list', { name: '分類小計' })).toHaveTextContent('食: NT$120')
    expect(within(aside).getByRole('progressbar')).toBeInTheDocument()
    expect(within(aside).getByRole('button', { name: '歸檔本期' })).toBeInTheDocument()
    expect([...actions.querySelectorAll('button')].map((b) => b.textContent?.trim())).toEqual(['批次加入固定支出', '＋ 新增記帳'])
    expect(actions).toHaveClass('ml-auto')
  })

  it('立即歸檔本期：確認後清空本期，記帳本出現新的一期，可還原', () => {
    const today = toLocalISO()
    const p = billingPeriod()
    useAppStore.setState({ shopping: [ex('午餐', today, 120), ex('晚餐', today, 180)] })
    render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('歸檔本期'))
    fireEvent.click(within(screen.getByRole('dialog')).getByText('歸檔'))
    expect(useAppStore.getState().shopping).toHaveLength(0)
    expect(useAppStore.getState().archives[0]).toMatchObject({ start: p.start, end: p.end })
    expect(screen.getByText(`${p.start.slice(0, 4)} 年記帳本`)).toBeInTheDocument()
    expect(screen.getByText('歸檔本期').closest('button')).toBeDisabled()

    fireEvent.click(screen.getByText('還原到記帳清單'))
    expect(useAppStore.getState().shopping).toHaveLength(2)
    expect(useAppStore.getState().archives).toHaveLength(0)
  })

  describe('單筆自訂貨幣', () => {
    it('新增時預帶設定頁的預設貨幣，並把幣別存進這一筆', () => {
      useAppStore.setState({ settings: { fontSize: 'md', currency: 'JPY' } })
      render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
      fireEvent.click(screen.getByText('＋ 新增記帳'))
      expect((screen.getByLabelText('幣別') as HTMLSelectElement).value).toBe('JPY')
      fireEvent.change(screen.getByLabelText('購買項目'), { target: { value: '抹茶' } })
      fireEvent.change(screen.getByLabelText('總金額（¥）'), { target: { value: '1200' } })
      fireEvent.click(screen.getByText('儲存'))
      expect(useAppStore.getState().shopping[0]).toMatchObject({ title: '抹茶', amt: 1200, currency: 'JPY' })
    })

    it('可以個別切換幣別，輸入框標籤跟著換符號', () => {
      render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
      fireEvent.click(screen.getByText('＋ 新增記帳'))
      fireEvent.change(screen.getByLabelText('購買項目'), { target: { value: '機場咖啡' } })
      fireEvent.change(screen.getByLabelText('幣別'), { target: { value: 'USD' } })
      fireEvent.change(screen.getByLabelText('總金額（US$）'), { target: { value: '4.5' } })
      fireEvent.click(screen.getByText('儲存'))
      expect(useAppStore.getState().shopping[0]).toMatchObject({ amt: 4.5, currency: 'USD' })
      expect(screen.getAllByText('US$4.5').length).toBeGreaterThan(0)
    })

    it('支援自訂幣別符號；沒填符號不能儲存', () => {
      render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
      fireEvent.click(screen.getByText('＋ 新增記帳'))
      fireEvent.change(screen.getByLabelText('購買項目'), { target: { value: '芒果糯米' } })
      fireEvent.change(screen.getByLabelText('幣別'), { target: { value: '__custom__' } })
      fireEvent.click(screen.getByText('儲存'))
      expect(screen.getByText('請輸入自訂幣別符號')).toBeInTheDocument()
      expect(useAppStore.getState().shopping).toHaveLength(0)
      fireEvent.change(screen.getByLabelText('自訂幣別符號'), { target: { value: '฿' } })
      fireEvent.change(screen.getByLabelText('總金額（฿）'), { target: { value: '120' } })
      fireEvent.click(screen.getByText('儲存'))
      expect(useAppStore.getState().shopping[0]).toMatchObject({ amt: 120, currency: '฿' })
      expect(screen.getAllByText('฿120').length).toBeGreaterThan(0)
      // 用過的自訂符號會出現在下一筆的選單裡
      fireEvent.click(screen.getByText('＋ 新增記帳'))
      expect(within(screen.getByLabelText('幣別')).getByRole('option', { name: '฿（自訂）' })).toBeInTheDocument()
    })

    it('不同幣別分開小計、不相加；預算只算預設貨幣', () => {
      const { start } = billingPeriod()
      useAppStore.setState({ shopping: [ex('a', start, 1200), ex('b', start, 15, 'USD'), ex('c', start, 300, 'TWD'), ex('d', start, 0, 'JPY')] })
      render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
      expect(screen.getByTestId('period-total').textContent).toBe('NT$1,500+US$15')
      expect(screen.getByText(fullText('食: NT$1,500+US$15'))).toBeInTheDocument()
      // 金額 0 的日圓項目只是購物清單，不會多出 ¥0
      expect(screen.getByTestId('period-total').textContent).not.toContain('¥')
      expect(screen.getByText('預算進度 7.5%')).toBeInTheDocument()
      expect(screen.getByText(/預算進度只計算 NT\$ 的支出/)).toBeInTheDocument()
    })

    it('舊資料沒有幣別：照設定頁的預設貨幣顯示，跟改版前一樣；編輯時預選它', () => {
      const { start } = billingPeriod()
      useAppStore.setState({ settings: { fontSize: 'md', currency: 'JPY' }, shopping: [ex('舊的一筆', start, 800)] })
      render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
      expect(screen.getByTestId('period-total').textContent).toBe('¥800')
      expect(screen.queryByText(/預算進度只計算/)).not.toBeInTheDocument()
      fireEvent.click(screen.getByText('舊的一筆'))
      expect((screen.getByLabelText('幣別') as HTMLSelectElement).value).toBe('JPY')
    })

    it('年度記帳本依幣別分開加總', () => {
      useAppStore.setState({
        archives: [
          { start: '2025-11-10', end: '2025-12-09', archivedAt: 1, expenses: [ex('x', '2025-11-11', 500), ex('y', '2025-11-12', 20, 'EUR')] },
          { start: '2025-12-10', end: '2026-01-09', archivedAt: 2, expenses: [ex('z', '2025-12-11', 200), ex('w', '2025-12-12', 5.5, 'EUR')] },
        ],
      })
      render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
      fireEvent.click(screen.getByRole('button', { name: '2025' }))
      expect(screen.getByText(fullText('共 2 期 · NT$700+€25.5'))).toBeInTheDocument()
    })
  })
  it('記帳清單跟用品清單共用網格：手機 1 欄、1001px 起 2 欄、1360px 起 3 欄，打勾、編輯、刪除照常', async () => {
    const d = toLocalISO()
    useAppStore.setState({ shopping: [ex('牛奶', d), ex('麵包', d), ex('雞蛋', d)] })
    render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
    const list = screen.getByRole('list', { name: '記帳清單' })
    expect(list).toHaveClass('grid', 'gap-3', 'min-[1001px]:grid-cols-2', 'min-[1360px]:grid-cols-3')
    expect(list.className).not.toMatch(/(^|\s)grid-cols-3/)
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)

    // 庫存頁的用品清單使用同一組排版
    const { InventoryPage } = await import('./InventoryPage')
    const inv = render(<MemoryRouter><InventoryPage /></MemoryRouter>)
    expect(within(inv.container).getByRole('list', { name: '用品清單' }).className).toBe(list.className)
    inv.unmount()

    fireEvent.click(within(list).getAllByRole('button', { name: '標記為已購' })[0]!)
    expect(useAppStore.getState().shopping.find((x) => x.id === '牛奶')?.done).toBe(true)
    fireEvent.click(within(list).getByText('麵包'))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByText('刪除'))
    expect(useAppStore.getState().shopping.map((x) => x.id)).toEqual(['牛奶', '雞蛋'])
  })
})
