import 'fake-indexeddb/auto'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { TasksPage } from '../pages/TasksPage'
import { useAppStore } from '../store/useAppStore'
import { useState } from 'react'
import { CommandPalette } from './CommandPalette'

// 命中的關鍵字會被切成多個節點，所以用整段文字比對
const title = (text: string) => screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === text && el.className.includes('truncate'))
const queryTitle = (text: string) => screen.queryByText((_, el) => el?.tagName === 'SPAN' && el.textContent === text && el.className.includes('truncate'))

function Harness() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  return (
    <>
      <span data-testid="path">{loc.pathname}</span>
      <CommandPalette open={open} onOpenChange={setOpen} />
      <Routes>
        <Route path="/" element={null} />
        <Route path="/tasks" element={<TasksPage />} />
      </Routes>
    </>
  )
}

describe('CommandPalette', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState({
      ...emptyAppData(),
      tasks: [
        {
          id: 't1',
          title: '回覆設計師',
          loc: '',
          date: '',
          time: '',
          done: false,
        },
      ],
      places: [
        {
          id: 'p1',
          name: '秋紅谷公園',
          cat: 'park',
          address: '',
          hours: '',
          note: '',
          url: '',
        },
      ],
    })
  })

  it('Ctrl+K 開啟，選到待辦後跳到待辦頁並開啟編輯', () => {
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    )
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = screen.getByPlaceholderText('搜尋任務、備註、行程或地點…')
    fireEvent.change(input, { target: { value: '設計師' } })
    expect(queryTitle('秋紅谷公園')).not.toBeInTheDocument()
    fireEvent.click(title('回覆設計師'))
    expect(screen.getByTestId('path')).toHaveTextContent('/tasks')
    expect(screen.getByRole('dialog', { name: '編輯待辦' })).toBeInTheDocument()
  })

  it('空查詢顯示提示；分頁、清除與最近搜尋可用', () => {
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    )
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByText('依任務名稱、備註、行程或地點搜尋')).toBeInTheDocument()
    const box = () => screen.getByPlaceholderText('搜尋任務、備註、行程或地點…')
    fireEvent.change(box(), { target: { value: '公園' } })
    expect(title('秋紅谷公園')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /稍後辦/ }))
    expect(queryTitle('秋紅谷公園')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /全部/ }))
    fireEvent.click(title('秋紅谷公園'))
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.click(screen.getByRole('button', { name: '公園' }))
    expect(box()).toHaveValue('公園')
    fireEvent.click(screen.getByRole('button', { name: '清除' }))
    expect(box()).toHaveValue('')
  })
})
