import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { toLocalISO } from '../core/date'
import { emptyAppData, type Expense } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { CalendarPage } from './CalendarPage'
import { TodayPage } from './TodayPage'

const today = toLocalISO()
const item = (p: Partial<Expense> = {}): Expense => ({ id: 's1', title: '鳳梨', amt: 150, store: '第五市場', cat: 'food', date: today, time: '08:00', done: false, currency: 'TWD', ...p })

function Where() {
  const loc = useLocation()
  return <p data-testid="where">{loc.pathname + loc.search}</p>
}

const renderAt = (page: React.ReactNode, path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={page} />
        <Route path="/calendar" element={page} />
        <Route path="/shopping" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

describe('購物記帳單向同步到行事曆', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState({ ...emptyAppData(), shopping: [item()] })
  })

  it('月曆格子與當日清單顯示購物圖示、名稱、地點、金額', () => {
    renderAt(<CalendarPage />, '/calendar')
    const cell = screen.getAllByRole('gridcell').find((c) => c.getAttribute('aria-selected') === 'true')!
    expect(within(cell).getByRole('button', { name: /鳳梨 · 第五市場 · NT\$150/ })).toBeInTheDocument()
    expect(screen.getAllByText(/鳳梨 · 第五市場/).length).toBeGreaterThanOrEqual(2)
    // 沒有寫進行程資料，維持單一資料來源
    expect(useAppStore.getState().events).toHaveLength(0)
  })

  it('點開是唯讀詳情，沒有刪除或儲存，按鈕導到購物清單並帶 ?open=', () => {
    renderAt(<CalendarPage />, '/calendar')
    const cell = screen.getAllByRole('gridcell').find((c) => c.getAttribute('aria-selected') === 'true')!
    fireEvent.click(within(cell).getByRole('button', { name: /鳳梨/ }))
    const dialog = screen.getByRole('dialog', { name: '購物記帳連動行程' })
    expect(within(dialog).queryByText('刪除')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('儲存')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByText('前往購物清單編輯'))
    expect(screen.getByTestId('where')).toHaveTextContent('/shopping?open=s1')
  })

  it('記帳修改或刪除後，行事曆即時跟著變', () => {
    renderAt(<CalendarPage />, '/calendar')
    act(() => {
      useAppStore.getState().updateExpense('s1', { title: '芭樂', amt: 80 })
    })
    expect(screen.getAllByText(/芭樂 · 第五市場 · NT\$80/).length).toBeGreaterThan(0)
    act(() => {
      useAppStore.getState().removeExpense('s1')
    })
    expect(screen.queryByText(/芭樂/)).not.toBeInTheDocument()
  })

  it('跟一般行程合計最多 6 筆', () => {
    useAppStore.setState({
      events: Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, title: `事項${i + 1}`, dateISO: today, start: `1${i}:00`, end: `1${i}:30`, note: '' })),
    })
    renderAt(<CalendarPage />, '/calendar')
    const cell = screen.getAllByRole('gridcell').find((c) => c.getAttribute('aria-selected') === 'true')!
    // 購物在 08:00 排第一，第 6 個行程被折起來
    expect(within(cell).getByRole('button', { name: /鳳梨/ })).toBeInTheDocument()
    expect(within(cell).queryByRole('button', { name: /事項6/ })).not.toBeInTheDocument()
    expect(within(cell).getByText('還有 1 個')).toBeInTheDocument()
  })

  it('每筆用自己的幣別，歸檔的記帳也顯示但改成前往記帳本查看', () => {
    useAppStore.setState({
      shopping: [item({ currency: 'JPY', amt: 500, title: '飯糰' })],
      archives: [{ start: today, end: today, archivedAt: 0, expenses: [item({ id: 'old', title: '舊帳', time: '' })] }],
    })
    renderAt(<CalendarPage />, '/calendar')
    expect(screen.getAllByText(/飯糰 · 第五市場 · [¥￥]500/).length).toBeGreaterThan(0)
    const card = screen.getAllByText(/舊帳/).at(-1)!.closest('button')!
    expect(card).toHaveTextContent('整天')
    fireEvent.click(card)
    fireEvent.click(within(screen.getByRole('dialog')).getByText('前往記帳本查看'))
    expect(screen.getByTestId('where')).toHaveTextContent('/shopping?open=old')
  })

  it('今天時間軸與一週檢視也會顯示，且不佔用節奏時間', () => {
    renderAt(<TodayPage />)
    expect(screen.getByText(/鳳梨 · 第五市場 · NT\$150/)).toBeInTheDocument()
    expect(screen.getByText('已安排 0 小時')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '一週' }))
    expect(screen.getByText(/鳳梨 · 第五市場 · NT\$150/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/鳳梨 · 第五市場/))
    expect(screen.getByRole('dialog', { name: '購物記帳連動行程' })).toBeInTheDocument()
  })
})
