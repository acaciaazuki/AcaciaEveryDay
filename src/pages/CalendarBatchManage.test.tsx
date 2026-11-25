import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { CalendarPage } from './CalendarPage'

const app = () => useAppStore.getState()
const ev = (id: string, title: string, dateISO: string, start = '09:00') => ({ id, title, dateISO, start, end: '10:00', note: '' })
const liveIds = () => app().events.filter((e) => e.deletedAt === undefined).map((e) => e.id)
const dayBox = (iso: string) => screen.queryByRole('checkbox', { name: `全選 ${iso}` }) as HTMLInputElement | null
const chip = (title: string) => screen.getByRole('checkbox', { name: `選取「${title}」` })
const bar = () => screen.getByRole('toolbar', { name: '批次操作' })

describe('行事曆批次管理', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.setSystemTime(new Date(2026, 10, 24, 10, 0))
    useAppStore.setState({ ...emptyAppData(), events: [ev('e1', '早會', '2026-11-10'), ev('e2', '查房', '2026-11-10', '11:00'), ev('e3', '晚餐', '2026-11-12')] })
  })
  afterEach(() => vi.useRealTimers())

  const open = () => render(<MemoryRouter><CalendarPage /></MemoryRouter>)
  const startManaging = () => fireEvent.click(screen.getByRole('button', { name: '批次管理' }))

  it('一般瀏覽時沒有勾選框與操作列；進入批次管理後才出現，操作列沒有「移至」', () => {
    open()
    expect(dayBox('2026-11-10')).toBeNull()
    expect(screen.queryByRole('toolbar')).toBeNull()
    startManaging()
    expect(dayBox('2026-11-10')).not.toBeNull()
    expect(bar()).toHaveTextContent('已選 0 項')
    expect(within(bar()).getByRole('button', { name: '批次刪除' })).toBeDisabled()
    expect(within(bar()).queryByText('移至')).toBeNull()
  })

  it('三態：手動勾一部分是半選，全部勾滿變全選；點全選當天整天加入或移除', () => {
    open()
    startManaging()
    fireEvent.click(chip('早會'))
    expect(dayBox('2026-11-10')!.indeterminate).toBe(true)
    expect(bar()).toHaveTextContent('已選 1 項')
    fireEvent.click(chip('查房'))
    expect(dayBox('2026-11-10')!.checked).toBe(true)
    fireEvent.click(dayBox('2026-11-10')!)
    expect(bar()).toHaveTextContent('已選 0 項')
    fireEvent.click(dayBox('2026-11-12')!)
    expect(chip('晚餐')).toHaveAttribute('aria-checked', 'true')
    expect(bar()).toHaveTextContent('已選 1 項')
  })

  it('批次刪除：移到最近刪除；復原時原樣放回（id 不變）', () => {
    open()
    startManaging()
    fireEvent.click(dayBox('2026-11-10')!)
    fireEvent.click(within(bar()).getByRole('button', { name: '批次刪除' }))
    expect(liveIds()).toEqual(['e3'])
    expect(screen.getByText('已將 2 項行程移到最近刪除')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '復原' }))
    act(() => void vi.runOnlyPendingTimers())
    expect(liveIds().sort()).toEqual(['e1', 'e2', 'e3'])
    expect(screen.getByText('已復原')).toBeInTheDocument()
  })
})
