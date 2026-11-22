import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { billingPeriod } from '../core/expenses'
import { emptyAppData, type Recurring } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { ShoppingPage } from './ShoppingPage'

const tpl = (id: string, patch: Partial<Recurring> = {}): Recurring => ({ id, name: id, cat: 'housing', amount: 1000, currency: 'TWD', day: 10, batchMonths: 1, note: '', done: false, ...patch })
const page = (url = '/shopping') => render(<MemoryRouter initialEntries={[url]}><ShoppingPage /></MemoryRouter>)

describe('ShoppingPage：週期固定支出', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
  })

  it('沒有範本時引導新增；新增範本後回到批次加入，預設全選', () => {
    page()
    fireEvent.click(screen.getByRole('button', { name: /批次加入固定支出/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByText('＋ 新增固定支出'))
    fireEvent.change(screen.getByLabelText('項目名稱'), { target: { value: '保險月繳' } })
    fireEvent.click(screen.getByRole('combobox', { name: '分類' }))
    fireEvent.click(screen.getByRole('option', { name: /保險/ }))
    fireEvent.change(screen.getByLabelText('預設金額（NT$）'), { target: { value: '2300' } })
    fireEvent.change(screen.getByLabelText('每月扣款日'), { target: { value: '15' } })
    fireEvent.click(screen.getByText('儲存'))
    expect(useAppStore.getState().recurring[0]).toMatchObject({ name: '保險月繳', cat: 'insurance', amount: 2300, day: 15 })
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('checkbox')).toBeChecked()
    expect(within(dialog).getByText('確認加入（1 筆）')).toBeInTheDocument()
  })

  it('微調金額與備註後批次加入，計入本期總額與分類；再開一次顯示「本期已加入」', () => {
    useAppStore.setState({ recurring: [tpl('房租', { amount: 12000, day: 10 }), tpl('手機', { cat: 'other', customCat: '通訊', amount: 599, day: 5 }), tpl('舊分期', { done: true })] })
    page()
    fireEvent.click(screen.getByRole('button', { name: /批次加入固定支出/ }))
    let dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByText('舊分期')).toBeNull()
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(2)
    const amounts = within(dialog).getAllByLabelText('本期金額（NT$）')
    fireEvent.change(amounts[1]!, { target: { value: '650' } })
    fireEvent.change(within(dialog).getAllByLabelText('備註')[1]!, { target: { value: '含漫遊' } })
    fireEvent.click(within(dialog).getByText('確認加入（2 筆）'))

    const p = billingPeriod()
    const { shopping } = useAppStore.getState()
    expect(shopping).toHaveLength(2)
    for (const e of shopping) expect(e.date >= p.start && e.date <= p.end).toBe(true)
    expect(shopping.find((e) => e.title === '手機')).toMatchObject({ amt: 650, note: '含漫遊', customCat: '通訊' })
    expect(screen.getByTestId('period-total').textContent).toBe('NT$12,650')
    expect(screen.getByText('已加入 2 筆固定支出')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /批次加入固定支出/ }))
    dialog = screen.getByRole('dialog')
    expect(within(dialog).getAllByText('本期已加入')).toHaveLength(2)
    expect(within(dialog).getAllByRole('checkbox').every((c) => (c as HTMLInputElement).disabled)).toBe(true)
    expect(within(dialog).getByText('確認加入（0 筆）').closest('button')).toBeDisabled()
  })

  it('從搜尋結果的網址直接打開範本編輯', () => {
    useAppStore.setState({ recurring: [tpl('r1', { name: '管理費' })] })
    page('/shopping?recurring=r1')
    expect(screen.getByRole('dialog', { name: '編輯固定支出' })).toBeInTheDocument()
    expect((screen.getByLabelText('項目名稱') as HTMLInputElement).value).toBe('管理費')
  })

  it('表單：設定批次月數與分期（共分幾期／已付到第幾期），驗證已付不能大於總期數', () => {
    page()
    fireEvent.click(screen.getByRole('button', { name: /批次加入固定支出/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByText('＋ 新增固定支出'))
    fireEvent.change(screen.getByLabelText('項目名稱'), { target: { value: '手機分期' } })
    fireEvent.change(screen.getByLabelText('預設金額（NT$）'), { target: { value: '1000' } })
    expect((screen.getByLabelText('一次批次加幾個月') as HTMLInputElement).value).toBe('1')
    fireEvent.change(screen.getByLabelText('一次批次加幾個月'), { target: { value: '13' } })
    // 瀏覽器原生的 min/max 檢查會先擋；這裡直接送出表單，確認程式端的驗證也會擋
    fireEvent.submit(screen.getByText('儲存').closest('form')!)
    expect(screen.getByText('批次月數請填 1 到 12 的整數')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('一次批次加幾個月'), { target: { value: '3' } })

    fireEvent.click(screen.getByLabelText('分期付款'))
    fireEvent.change(screen.getByLabelText('共分幾期'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('已付到第幾期'), { target: { value: '7' } })
    fireEvent.submit(screen.getByText('儲存').closest('form')!)
    expect(screen.getByText('已付到第幾期要介於 0 到共分幾期之間')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('已付到第幾期'), { target: { value: '2' } })
    expect(screen.getByTestId('installment-status').textContent).toBe('第 2 / 6 期 · 還有 4 期')
    fireEvent.click(screen.getByText('儲存'))
    expect(useAppStore.getState().recurring[0]).toMatchObject({ name: '手機分期', batchMonths: 3, installments: { total: 6, next: 3 }, done: false })

    // 批次加入：顯示進度與本次期數，一次加 3 筆
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('第 2 / 6 期')).toBeInTheDocument()
    const id = useAppStore.getState().recurring[0]!.id
    expect(within(dialog).getByTestId(`plan-${id}`).textContent).toContain('本次第 3–5 期')
    expect(within(dialog).getByLabelText('每月金額（NT$）')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByText('確認加入（3 筆）'))
    expect(useAppStore.getState().shopping.map((e) => e.installment).sort()).toEqual([3, 4, 5])
    expect(useAppStore.getState().recurring[0]!.installments).toEqual({ total: 6, next: 6 })
    expect(screen.getByText('已加入 3 筆固定支出')).toBeInTheDocument()
  })

  it('編輯舊分期：已付到第幾期由下一期換算，付完最後一期時提示完成', () => {
    useAppStore.setState({ recurring: [tpl('r1', { name: '信用卡分期', batchMonths: 2, installments: { total: 6, next: 5 } })] })
    page('/shopping?recurring=r1')
    expect((screen.getByLabelText('已付到第幾期') as HTMLInputElement).value).toBe('4')
    expect((screen.getByLabelText('一次批次加幾個月') as HTMLInputElement).value).toBe('2')
    fireEvent.click(screen.getByText('儲存'))
    fireEvent.click(screen.getByText('返回批次加入'))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/本次第 5–6 期 · 付完最後一期/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByText('確認加入（2 筆）'))
    expect(useAppStore.getState().recurring[0]).toMatchObject({ done: true, installments: { next: 7 } })
    expect(screen.getByText(/「信用卡分期」已付完最後一期，已標記完成。/)).toBeInTheDocument()
  })
})
