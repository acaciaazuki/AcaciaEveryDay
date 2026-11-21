import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { addDays, toLocalISO } from '../core/date'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { TodayPage } from './TodayPage'

const renderPage = () => render(<MemoryRouter><TodayPage /></MemoryRouter>)

describe('TodayPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
  })

  it('依行程時間計算空檔', () => {
    const d = toLocalISO()
    useAppStore.setState({
      events: [
        { id: 'a', title: '午餐', dateISO: d, start: '12:00', end: '13:00', note: '' },
        { id: 'b', title: '開會', dateISO: d, start: '15:00', end: '16:30', note: '' },
      ],
    })
    renderPage()
    expect(screen.getByText('已安排 2.5 小時')).toBeInTheDocument()
    expect(screen.getByText('還有 13.5 小時空檔')).toBeInTheDocument()
    expect(screen.getByText(/留給自己的空檔 · 2h/)).toBeInTheDocument()
  })

  it('從今天頁新增行程', () => {
    renderPage()
    fireEvent.click(screen.getByText('今天還沒有安排，點擊新增 ＋'))
    fireEvent.change(screen.getByLabelText('要做什麼？'), { target: { value: '散步' } })
    fireEvent.click(screen.getByText('儲存'))
    expect(screen.getAllByText('散步').length).toBeGreaterThan(0)
    expect(useAppStore.getState().events).toHaveLength(1)
  })

  it('快速新增待辦', () => {
    renderPage()
    fireEvent.click(screen.getByText('＋ 新增待辦'))
    fireEvent.change(screen.getByLabelText('輸入待辦事項按 Enter…'), { target: { value: '倒垃圾' } })
    fireEvent.submit(screen.getByLabelText('輸入待辦事項按 Enter…'))
    expect(screen.getByText('倒垃圾')).toBeInTheDocument()
  })

  it('用箭頭切換到明天、後天，並可回到今天', () => {
    const d = toLocalISO()
    useAppStore.setState({
      events: [
        { id: 'a', title: '今天的事', dateISO: d, start: '10:00', end: '11:00', note: '' },
        { id: 'b', title: '明天的事', dateISO: addDays(d, 1), start: '09:00', end: '12:00', note: '' },
      ],
    })
    renderPage()
    expect(screen.getByText('今天的事')).toBeInTheDocument()
    expect(screen.queryByText('回到今天')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('往後'))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('明天')
    expect(screen.getByText('明天的事')).toBeInTheDocument()
    expect(screen.queryByText('今天的事')).not.toBeInTheDocument()
    expect(screen.getByText('已安排 3 小時')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('往後'))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('後天')
    fireEvent.click(screen.getByLabelText('往後'))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('大後天')

    fireEvent.click(screen.getByText('回到今天'))
    expect(screen.getByText('今天的事')).toBeInTheDocument()
  })

  it('一週檢視依日期列出未來 7 天的行程', () => {
    const d = toLocalISO()
    useAppStore.setState({
      events: [
        { id: 'a', title: '第三天', dateISO: addDays(d, 2), start: '10:00', end: '11:00', note: '' },
        { id: 'b', title: '第八天', dateISO: addDays(d, 7), start: '10:00', end: '11:00', note: '' },
      ],
    })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '一週' }))
    expect(screen.getByText('第三天')).toBeInTheDocument()
    expect(screen.queryByText('第八天')).not.toBeInTheDocument()
    expect(screen.getAllByText('沒有行程')).toHaveLength(6)

    fireEvent.click(screen.getByRole('button', { name: '兩週' }))
    expect(screen.getByText('第八天')).toBeInTheDocument()
    expect(screen.getAllByText('沒有行程')).toHaveLength(12)

    // 一週檢視用箭頭整段往後翻
    fireEvent.click(screen.getByRole('button', { name: '一週' }))
    fireEvent.click(screen.getByLabelText('往後'))
    expect(screen.getByText('第八天')).toBeInTheDocument()
    expect(screen.queryByText('第三天')).not.toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: '檢視範圍' })).getByRole('button', { name: '一週' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('時間軸依標題自動帶出小圖示，手動選的圖示優先', () => {
    const d = toLocalISO()
    useAppStore.setState({
      events: [
        { id: 'a', title: '早餐', dateISO: d, start: '08:00', end: '08:30', note: '' },
        { id: 'b', title: '開會', dateISO: d, start: '10:00', end: '11:00', note: '' },
        { id: 'c', title: '隨便', dateISO: d, start: '13:00', end: '14:00', note: '', icon: 'exercise' },
        { id: 'd', title: '繳費', dateISO: d, start: '15:00', end: '15:30', note: '' },
      ],
    })
    const { container } = renderPage()
    expect([...container.querySelectorAll('[data-icon]')].map((n) => n.getAttribute('data-icon'))).toEqual(['meal', 'work', 'exercise', 'default'])
  })

  it('在行程表單手動選圖示會存進資料，選回自動就清掉', () => {
    const d = toLocalISO()
    useAppStore.setState({ events: [{ id: 'a', title: '早餐', dateISO: d, start: '08:00', end: '08:30', note: '' }] })
    const { container } = renderPage()
    fireEvent.click(screen.getByText('早餐'))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('radio', { name: '自動' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(within(dialog).getByRole('radio', { name: '運動' }))
    fireEvent.click(within(dialog).getByText('儲存'))
    expect(useAppStore.getState().events[0].icon).toBe('exercise')
    expect(container.querySelector('[data-icon]')).toHaveAttribute('data-icon', 'exercise')

    fireEvent.click(screen.getByText('早餐'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('radio', { name: '自動' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByText('儲存'))
    expect(useAppStore.getState().events[0].icon).toBeUndefined()
    expect(container.querySelector('[data-icon]')).toHaveAttribute('data-icon', 'meal')
  })
})
