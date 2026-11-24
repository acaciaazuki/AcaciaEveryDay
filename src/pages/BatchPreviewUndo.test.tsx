import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { CalendarPage } from './CalendarPage'

/** 在批次視窗裡點某一天（月曆格子的 aria-label 是 YYYY-MM-DD） */
const pick = (dialog: HTMLElement, iso: string) => fireEvent.click(within(dialog).getByRole('button', { name: iso }))

describe('批次新增：日期預覽與復原', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date(2026, 10, 24, 10, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('跨月份選的日期依序列成清單，可以單獨移除；送出的就是清單上的日期', () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('批次新增'))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('行程名稱'), { target: { value: '值班' } })
    pick(dialog, '2026-11-28')
    pick(dialog, '2026-11-03')
    fireEvent.click(within(dialog).getByRole('button', { name: '下個月' }))
    pick(dialog, '2026-12-05')

    const list = within(dialog).getByRole('list', { name: '已選的日期' })
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent?.replace('×', ''))).toEqual(['11/3（週二）', '11/28（週六）', '12/5（週六）'])
    // 在十二月的畫面也能移除十一月選的日期
    fireEvent.click(within(list).getByRole('button', { name: '移除 11/28（週六）' }))
    expect(within(dialog).getByText('已選 2 天')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByText('加入 2 天'))
    expect(useAppStore.getState().events.map((e) => e.dateISO)).toEqual(['2026-11-03', '2026-12-05'])
  })

  it('建立後顯示提示與「復原」：按下就刪掉剛建立的行程，其他行程不受影響', () => {
    useAppStore.getState().addEvent({ title: '原本的行程', dateISO: '2026-11-10', start: '09:00', end: '10:00', note: '' })
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('批次新增'))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('行程名稱'), { target: { value: '值班' } })
    pick(dialog, '2026-11-12')
    pick(dialog, '2026-11-13')
    fireEvent.click(within(dialog).getByText('加入 2 天'))
    expect(useAppStore.getState().events).toHaveLength(3)

    expect(screen.getByRole('status')).toHaveTextContent('已加入 2 天的「值班」')
    fireEvent.click(screen.getByRole('button', { name: '復原' }))
    act(() => void vi.runOnlyPendingTimers())
    expect(useAppStore.getState().events.map((e) => e.title)).toEqual(['原本的行程'])
    expect(screen.getByRole('status')).toHaveTextContent('已復原，移除了 2 筆行程')
    expect(screen.queryByRole('button', { name: '復原' })).toBeNull()
  })

  it('不按復原：提示約 8 秒後自動消失，行程保留', () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('批次新增'))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('行程名稱'), { target: { value: '值班' } })
    pick(dialog, '2026-11-12')
    fireEvent.click(within(dialog).getByText('加入 1 天'))
    act(() => void vi.advanceTimersByTime(8100))
    expect(screen.queryByRole('button', { name: '復原' })).toBeNull()
    expect(useAppStore.getState().events).toHaveLength(1)
  })
})
