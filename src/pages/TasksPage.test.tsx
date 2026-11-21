import 'fake-indexeddb/auto'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import '../i18n'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
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
})
