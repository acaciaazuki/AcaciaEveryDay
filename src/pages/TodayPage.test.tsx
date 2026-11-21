import 'fake-indexeddb/auto'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { toLocalISO } from '../core/date'
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
})
