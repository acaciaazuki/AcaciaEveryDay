import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import '../i18n'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { TodayPage } from './TodayPage'
import { TasksPage } from './TasksPage'

describe('TasksPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
  })

  it('新增、完成一筆待辦', () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>)
    expect(screen.getByText('目前沒有待辦事項 🎉')).toBeInTheDocument()
    fireEvent.click(screen.getByText('＋ 新增待辦'))
    fireEvent.change(screen.getByLabelText('待辦事項'), { target: { value: '買牛奶' } })
    fireEvent.click(screen.getByText('儲存'))
    expect(screen.getByText('買牛奶')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('標記為完成'))
    expect(useAppStore.getState().tasks[0].done).toBe(true)
    expect(screen.getByText('已完成 · 1')).toBeInTheDocument()
  })

  it('沒有標題時不能儲存', () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('＋ 新增待辦'))
    fireEvent.click(screen.getByText('儲存'))
    expect(screen.getByText('請輸入待辦事項')).toBeInTheDocument()
    expect(useAppStore.getState().tasks).toHaveLength(0)
  })

  it('背景色與文字色可以分開選，並同步到今天頁', () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('＋ 新增待辦'))
    fireEvent.change(screen.getByLabelText('待辦事項'), { target: { value: '寄信' } })
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('radio', { name: '#e4f0f7' }))
    fireEvent.click(within(dialog).getByRole('radio', { name: '梅紫' }))
    fireEvent.click(screen.getByText('儲存'))
    expect(useAppStore.getState().tasks[0]).toMatchObject({ bgColor: '#e4f0f7', titleColor: '#6b3f66' })
    expect(screen.getByText('寄信')).toHaveStyle({ color: '#6b3f66' })
  })

  it('舊資料沒有文字色時沿用預設，今天頁套用卡片顏色', () => {
    useAppStore.setState({
      tasks: [
        { id: 'old', title: '舊待辦', loc: '', date: '', time: '', done: false },
        { id: 'new', title: '新待辦', loc: '', date: '', time: '', done: false, bgColor: '#ebe6f6', titleColor: '#2f4468' },
      ],
    })
    const { unmount } = render(<MemoryRouter><TasksPage /></MemoryRouter>)
    expect(screen.getByText('舊待辦').style.color).toBe('')
    unmount()
    render(<MemoryRouter><TodayPage /></MemoryRouter>)
    expect(screen.getByText('新待辦').closest('li')).toHaveStyle({ background: '#ebe6f6', color: '#2f4468' })
    expect(screen.getByText('舊待辦').closest('li')).toBeInTheDocument()
  })
})
