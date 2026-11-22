import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays, toLocalISO } from '../core/date'
import { emptyAppData } from '../core/schema'
import i18n from '../i18n'
import { useAppStore } from '../store/useAppStore'
import { SubscriptionsPage } from './SubscriptionsPage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <SubscriptionsPage />
    </MemoryRouter>,
  )
const list = () => screen.getByRole('heading', { name: '訂閱清單' }).closest('section')!

describe('訂閱與續費頁', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
  })
  afterEach(() => vi.restoreAllMocks())

  it('第一次進入帶入 3 筆範例，且不算使用者修改（不更新 updatedAt）', () => {
    renderPage()
    const s = useAppStore.getState()
    expect(s.subscriptions).toHaveLength(3)
    expect(s.subscriptionsSeeded).toBe(true)
    expect(s.updatedAt).toBe(0)
    expect(within(list()).getByText('Google Gemini')).toBeInTheDocument()
    expect(within(list()).getByText('Claude')).toBeInTheDocument()
    // 看板：3 個使用中、30 天內 3 筆即將扣款
    expect(screen.getByText('3 個')).toBeInTheDocument()
    expect(screen.getByText('3 筆')).toBeInTheDocument()
  })

  it('刪光後不會再自動帶入範例，可以手動載入', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()
    for (const name of ['Google Gemini', 'Claude', 'Google One']) {
      fireEvent.click(within(list()).getByText(name))
      fireEvent.click(within(screen.getByRole('dialog')).getByText('刪除'))
    }
    expect(useAppStore.getState().subscriptions).toHaveLength(0)
    expect(screen.getByText(/還沒有訂閱/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('載入範例資料'))
    expect(useAppStore.getState().subscriptions).toHaveLength(3)
  })

  it('新增訂閱：出現在清單與即將扣款區，切換 7 天範圍會篩掉', () => {
    useAppStore.setState({ subscriptionsSeeded: true })
    renderPage()
    fireEvent.click(screen.getByText('＋ 新增訂閱'))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('服務名稱'), { target: { value: 'Netflix' } })
    fireEvent.change(within(dialog).getByLabelText('方案'), { target: { value: '標準' } })
    fireEvent.click(within(dialog).getByRole('radio', { name: '年付' }))
    fireEvent.change(within(dialog).getByLabelText('金額（NT$）'), { target: { value: '3900' } })
    fireEvent.change(within(dialog).getByLabelText('下次扣款日'), { target: { value: addDays(toLocalISO(), 10) } })
    fireEvent.click(within(dialog).getByText('儲存'))

    const [saved] = useAppStore.getState().subscriptions
    expect(saved).toMatchObject({ name: 'Netflix', plan: '標準', cycle: 'yearly', amount: 3900, currency: 'TWD', status: 'active' })
    expect(within(list()).getByText('Netflix')).toBeInTheDocument()
    const soon = screen.getByRole('list', { name: '即將扣款提醒' })
    expect(within(soon).getByText('還有 10 天')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '7 天' }))
    expect(screen.queryByRole('list', { name: '即將扣款提醒' })).toBeNull()
    expect(screen.getByText(/7 天內沒有要扣款的訂閱/)).toBeInTheDocument()
  })

  it('標記狀態：暫停的訂閱不列入統計', () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('狀態：Claude'), { target: { value: 'paused' } })
    expect(useAppStore.getState().subscriptions.find((s) => s.name === 'Claude')?.status).toBe('paused')
    expect(screen.getByText('2 個')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^暫停/ }))
    expect(within(list()).getByText('Claude')).toBeInTheDocument()
    expect(within(list()).queryByText('Google One')).toBeNull()
  })
})
