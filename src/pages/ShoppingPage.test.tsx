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

const ex = (id: string, date: string, amt = 100): Expense => ({ id, title: id, amt, store: '', cat: 'food', date, time: '12:00', done: false })

describe('ShoppingPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
  })

  it('新增自訂分類的記帳', () => {
    render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('＋ 新增記帳'))
    fireEvent.change(screen.getByLabelText('購買項目'), { target: { value: '貓砂' } })
    fireEvent.change(screen.getByLabelText('總金額'), { target: { value: '300' } })
    fireEvent.change(screen.getByLabelText('分類'), { target: { value: 'other' } })
    fireEvent.change(screen.getByLabelText('自訂分類名稱'), { target: { value: '寵物' } })
    fireEvent.click(screen.getByText('儲存'))
    expect(useAppStore.getState().shopping[0]).toMatchObject({ title: '貓砂', amt: 300, cat: 'other', customCat: '寵物' })
    expect(screen.getByText(/寵物: /)).toBeInTheDocument()
  })

  it('數量與單價自動算出總金額，改總金額時單價清空、不互相覆蓋', () => {
    render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('＋ 新增記帳'))
    fireEvent.change(screen.getByLabelText('購買項目'), { target: { value: '雞蛋' } })
    const total = screen.getByLabelText('總金額') as HTMLInputElement
    fireEvent.change(screen.getByLabelText('單價'), { target: { value: '12.5' } })
    expect(total.value).toBe('12.5')
    fireEvent.change(screen.getByLabelText('數量'), { target: { value: '3' } })
    expect(total.value).toBe('37.5')
    fireEvent.change(screen.getByLabelText('單價'), { target: { value: '' } })
    expect(total.value).toBe('37.5')
    fireEvent.change(screen.getByLabelText('單價'), { target: { value: '10' } })
    expect(total.value).toBe('30')
    // 手動改總金額：單價清空，之後改數量不會把總金額蓋回去
    fireEvent.change(total, { target: { value: '99' } })
    expect((screen.getByLabelText('單價') as HTMLInputElement).value).toBe('')
    fireEvent.change(screen.getByLabelText('數量'), { target: { value: '5' } })
    expect(total.value).toBe('99')
    fireEvent.change(screen.getByLabelText('單價'), { target: { value: '20' } })
    expect(total.value).toBe('100')
    fireEvent.click(screen.getByText('儲存'))
    expect(useAppStore.getState().shopping[0]).toMatchObject({ amt: 100, quantity: 5, unitPrice: 20 })
    expect(screen.getByText(/5 × /)).toBeInTheDocument()
  })

  it('沒填單價就維持舊格式，背景色與文字色可分開選', () => {
    render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('＋ 新增記帳'))
    fireEvent.change(screen.getByLabelText('購買項目'), { target: { value: '拿鐵' } })
    fireEvent.change(screen.getByLabelText('總金額'), { target: { value: '120' } })
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
    expect(screen.getByText('共 1 期 · $700')).toBeInTheDocument()
    expect(screen.getByText('2025-12-10 – 2026-01-09')).toBeInTheDocument()
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
})
