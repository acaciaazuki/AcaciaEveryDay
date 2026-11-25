import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { CalendarPage } from '../pages/CalendarPage'
import { EventDialog } from './EventDialog'

const setHour = (label: '開始' | '結束', hh: string) => fireEvent.change(screen.getByLabelText(`${label} 小時`), { target: { value: hh } })
const setMinute = (label: '開始' | '結束', mm: string) => fireEvent.change(screen.getByLabelText(`${label} 分鐘`), { target: { value: mm } })
const events = () => useAppStore.getState().events

describe('行程表單：結束日期與跨午夜', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
  })

  const open = () => {
    const onClose = vi.fn()
    render(<EventDialog event={null} date="2026-12-10" onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('要做什麼？'), { target: { value: '大夜班' } })
    return onClose
  }

  it('結束日期預設跟開始日期同一天；22:30～02:00 提示跨過午夜，儲存後結束日是隔天', () => {
    const onClose = open()
    expect(screen.getByLabelText('結束日期')).toHaveValue('2026-12-10')
    setHour('開始', '22')
    setMinute('開始', '30')
    setHour('結束', '02')
    expect(document.querySelector('[data-overnight]')).toHaveTextContent('跨過午夜：結束在 2026-12-11')
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))
    expect(onClose).toHaveBeenCalled()
    expect(events()[0]).toMatchObject({ dateISO: '2026-12-10', endDateISO: '2026-12-11', start: '22:30', end: '02:00' })
  })

  it('結束時間改回比開始晚：不再提示，存成同一天', () => {
    open()
    setHour('結束', '08')
    expect(document.querySelector('[data-overnight]')).not.toBeNull()
    setHour('結束', '11')
    expect(document.querySelector('[data-overnight]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))
    expect(events()[0]).toMatchObject({ dateISO: '2026-12-10', endDateISO: '', start: '09:00', end: '11:00' })
  })

  it('結束日期早於開始日期、或同一天同時間：擋下並提示', () => {
    open()
    // 結束日期早於開始：日期欄位本身就不接受（min），不會儲存
    fireEvent.change(screen.getByLabelText('結束日期'), { target: { value: '2026-12-09' } })
    expect(screen.getByLabelText('結束日期')).toBeInvalid()
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))
    expect(events()).toEqual([])
    // 同一天、開始與結束同時間：長度為零，擋下並提示
    fireEvent.change(screen.getByLabelText('結束日期'), { target: { value: '2026-12-10' } })
    setHour('結束', '09')
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))
    expect(screen.getByText('結束時間要晚於開始時間')).toBeInTheDocument()
    expect(events()).toEqual([])
  })

  it('開始日期往後調：結束日期跟著順延、保持天數；跨日改成單日', () => {
    open()
    fireEvent.change(screen.getByLabelText('結束日期'), { target: { value: '2026-12-12' } })
    fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-12-20' } })
    expect(screen.getByLabelText('結束日期')).toHaveValue('2026-12-22')
    // 結束日期改回跟開始同一天：變成單日行程
    fireEvent.change(screen.getByLabelText('結束日期'), { target: { value: '2026-12-20' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))
    expect(events()[0]).toMatchObject({ dateISO: '2026-12-20', endDateISO: '' })
  })
})

describe('月曆：跨日行程的連續橫條', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-15T09:00:00'))
    useAppStore.setState({
      ...emptyAppData(),
      events: [
        { id: 'trip', title: '家庭旅遊', dateISO: '2026-12-20', endDateISO: '2026-12-22', start: '', end: '', note: '' },
        { id: 'night', title: '大夜班', dateISO: '2026-12-10', endDateISO: '2026-12-11', start: '22:30', end: '02:00', note: '' },
      ],
    })
  })
  afterEach(() => vi.useRealTimers())

  const cell = (iso: string) => screen.getByRole('gridcell', { name: new RegExp(iso) })

  it('個人行程：涵蓋的每一天都有標籤，依位置接成橫條；跨午夜顯示這一天那一段的時間', () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    const chipIn = (iso: string, title: string) => within(cell(iso)).getByRole('button', { name: new RegExp(title) })
    expect(['2026-12-20', '2026-12-21', '2026-12-22'].map((d) => chipIn(d, '家庭旅遊').getAttribute('data-span'))).toEqual(['start', 'middle', 'end'])
    expect(within(cell('2026-12-23')).queryByRole('button', { name: /家庭旅遊/ })).toBeNull()
    expect(chipIn('2026-12-10', '大夜班')).toHaveTextContent('22:30 → 大夜班')
    expect(chipIn('2026-12-11', '大夜班')).toHaveTextContent('→ 02:00 大夜班')
  })

  it('當天清單顯示完整起訖', () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    fireEvent.click(cell('2026-12-11'))
    expect(within(screen.getByRole('dialog')).getByText(/12\/10 22:30 – 12\/11 02:00/)).toBeInTheDocument()
  })
})
