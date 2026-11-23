import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { toLocalISO } from '../core/date'
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
    fireEvent.click(screen.getByText('批次新增'))
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

  it('批次新增可選十種文字顏色與整天', () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('批次新增'))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('行程名稱'), { target: { value: '旅行' } })
    const textColors = within(dialog).getByRole('radiogroup', { name: '文字顏色' })
    expect(within(textColors).getAllByRole('radio')).toHaveLength(10)
    fireEvent.click(within(textColors).getByRole('radio', { name: '青碧' }))
    fireEvent.click(within(dialog).getByRole('switch', { name: '整天' }))
    expect(within(dialog).queryByText('開始')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getAllByRole('button', { pressed: false })[4])
    fireEvent.click(within(dialog).getByText('加入 1 天'))
    expect(useAppStore.getState().events[0]).toMatchObject({ title: '旅行', start: '', end: '', titleColor: '#2c5e66', bgColor: '#eaf6ef' })
  })

  it('新增事件可設整天，取消整天會還原時間', () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('＋ 新增事件'))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/要做什麼/), { target: { value: '連假' } })
    const sw = within(dialog).getByRole('switch', { name: '整天' })
    fireEvent.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(sw)
    expect(within(dialog).getByLabelText('開始 小時')).toHaveValue('09')
    fireEvent.click(sw)
    fireEvent.click(within(dialog).getByText('儲存'))
    expect(useAppStore.getState().events[0]).toMatchObject({ title: '連假', start: '', end: '' })
  })

  it('行事曆版面用 24 小時制，整天的行程標示「整天」', () => {
    const d = toLocalISO()
    useAppStore.setState({
      events: [
        { id: 'a', title: '晚餐', dateISO: d, start: '19:30', end: '21:05', note: '' },
        { id: 'b', title: '露營', dateISO: d, start: '', end: '', note: '' },
      ],
    })
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    const cell = screen.getAllByRole('gridcell').find((c) => c.getAttribute('aria-selected') === 'true')!
    expect(within(cell).getByRole('button', { name: '19:30 晚餐' })).toBeInTheDocument()
    expect(within(cell).getByRole('button', { name: '露營' })).toBeInTheDocument()
    expect(screen.getByText(/19:30–21:05/)).toBeInTheDocument()
    expect(screen.queryByText(/PM/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /露營.*整天/ })).toBeInTheDocument()
  })

  it('沒選日期時提示', () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('批次新增'))
    fireEvent.change(screen.getByLabelText('行程名稱'), { target: { value: '上班' } })
    fireEvent.click(screen.getByText('加入 0 天'))
    expect(screen.getByText('請至少選擇一天')).toBeInTheDocument()
  })

  it('單日最多顯示 6 筆，超過才折成「還有 X 個」', () => {
    const d = toLocalISO()
    useAppStore.setState({
      events: Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, title: `事項${i + 1}`, dateISO: d, start: `0${i + 1}:00`, end: `0${i + 1}:30`, note: '' })),
    })
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    const cell = screen.getAllByRole('gridcell').find((c) => c.getAttribute('aria-selected') === 'true')!
    expect(within(cell).getByRole('button', { name: /事項6/ })).toBeInTheDocument()
    expect(within(cell).queryByRole('button', { name: /事項7/ })).not.toBeInTheDocument()
    expect(within(cell).getByText('還有 2 個')).toBeInTheDocument()
  })

  it('行程的背景色與文字色分開選，預覽跟著變色並存檔', () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('＋ 新增事件'))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/要做什麼/), { target: { value: '看展' } })
    expect(within(dialog).getAllByRole('radio', { name: /^(深灰黑|森林綠|暖棕咖|磚紅|海軍藍|梅紫|灰藍|橄欖棕|青碧|焦糖棕)$/ })).toHaveLength(10)
    fireEvent.click(within(dialog).getByRole('radio', { name: '#ebe6f6' }))
    fireEvent.click(within(dialog).getByRole('radio', { name: '磚紅' }))
    expect(within(dialog).getByText('看展', { selector: 'div' })).toHaveStyle({ background: '#ebe6f6', color: '#8f3f3a' })
    fireEvent.click(within(dialog).getByText('儲存'))
    expect(useAppStore.getState().events[0]).toMatchObject({ bgColor: '#ebe6f6', titleColor: '#8f3f3a' })
  })
})
