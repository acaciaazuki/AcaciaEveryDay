import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { ShoppingPage } from './ShoppingPage'

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
})
