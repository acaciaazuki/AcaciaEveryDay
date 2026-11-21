import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { CalendarPage } from './CalendarPage'

describe('CalendarPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
  })

  it('批次新增多天的行程', () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('🔁 批次新增'))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('行程名稱'), { target: { value: '上班' } })
    const days = within(dialog).getAllByRole('button', { pressed: false })
    fireEvent.click(days[2])
    fireEvent.click(days[3])
    expect(within(dialog).getByText('已選 2 天')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByText('加入 2 天'))
    const ev = useAppStore.getState().events
    expect(ev).toHaveLength(2)
    expect(ev[0]).toMatchObject({ title: '上班', start: '09:00', end: '17:00', note: '批次建立' })
    expect(ev[0].dateISO < ev[1].dateISO).toBe(true)
  })

  it('沒選日期時提示', () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('🔁 批次新增'))
    fireEvent.change(screen.getByLabelText('行程名稱'), { target: { value: '上班' } })
    fireEvent.click(screen.getByText('加入 0 天'))
    expect(screen.getByText('請至少選擇一天')).toBeInTheDocument()
  })
})
