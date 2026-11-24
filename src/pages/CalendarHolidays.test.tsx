import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { toLocalISO } from '../core/date'
import { emptyAppData, type HolidaySet } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { CalendarPage } from './CalendarPage'
import { TodayPage } from './TodayPage'

const today = toLocalISO()
const year = Number(today.slice(0, 4))
const set = (p: Partial<HolidaySet> = {}): HolidaySet => ({ country: 'TW', year, source: 'official', importedAt: 1, days: [{ date: today, name: '測試假日' }], ...p })

const renderPage = (page: React.ReactNode) => render(<MemoryRouter>{page}</MemoryRouter>)
const selectedCell = () => screen.getAllByRole('gridcell').find((c) => c.getAttribute('aria-selected') === 'true')!

describe('行事曆的國定假日', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState({ ...emptyAppData() })
  })

  it('月曆格子與當日清單用專屬樣式與「國定假日」標籤顯示，且不能點開編輯', () => {
    useAppStore.setState({ holidays: [set()] })
    renderPage(<CalendarPage />)
    const chip = selectedCell().querySelector('[data-holiday]')!
    expect(chip).toHaveTextContent('測試假日')
    expect(chip.tagName).not.toBe('BUTTON')
    // 點日期打開「這一天」，裡面的假日卡片
    fireEvent.click(selectedCell())
    const day = screen.getByRole('dialog')
    const card = within(day).getByText('測試假日').closest('[data-holiday]')!
    expect(within(card as HTMLElement).getByText('國定假日')).toBeInTheDocument()
    expect(card.closest('button')).toBeNull()
    // 假日不是一般行程，不會寫進 events
    expect(useAppStore.getState().events).toHaveLength(0)
  })

  it('補班日顯示「補班」', () => {
    useAppStore.setState({ holidays: [set({ days: [{ date: today, name: '補行上班', work: true }] })] })
    renderPage(<CalendarPage />)
    fireEvent.click(selectedCell())
    expect(within(screen.getByRole('dialog')).getAllByText('補班').length).toBeGreaterThan(0)
  })

  it('今天頁也看得到假日', () => {
    useAppStore.setState({ holidays: [set()] })
    renderPage(<TodayPage />)
    expect(screen.getByText('測試假日').closest('[data-holiday]')).not.toBeNull()
  })

  it('選國家匯入、重複匯入不會重複，並可一鍵清除', async () => {
    renderPage(<CalendarPage />)
    fireEvent.click(screen.getByRole('button', { name: '國定假日' }))
    const dialog = screen.getByRole('dialog', { name: '匯入國定假日' })
    fireEvent.change(within(dialog).getByLabelText('國家／地區'), { target: { value: 'JP' } })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: '匯入國定假日' })).toBeEnabled())
    await waitFor(() => expect(within(dialog).getByText(/date-holidays/)).toBeInTheDocument())

    fireEvent.click(within(dialog).getByRole('button', { name: '匯入國定假日' }))
    const first = useAppStore.getState().holidays
    expect(first.length).toBeGreaterThan(0)
    expect(first.every((s) => s.country === 'JP')).toBe(true)
    expect(useAppStore.getState().settings.holidayCountry).toBe('JP')
    expect(within(dialog).getByRole('status')).toHaveTextContent('已匯入')

    fireEvent.click(within(dialog).getByRole('button', { name: '匯入國定假日' }))
    expect(useAppStore.getState().holidays).toHaveLength(first.length)
    expect(within(dialog).getByRole('status')).toHaveTextContent('已更新')

    const row = dialog.querySelector('[data-imported="JP"]') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: '清除' }))
    act(() => fireEvent.click(within(row).getByRole('button', { name: '清除假日' })))
    expect(useAppStore.getState().holidays).toHaveLength(0)
    expect(within(dialog).getByText('還沒有匯入任何國家的假日。')).toBeInTheDocument()
  })
})
