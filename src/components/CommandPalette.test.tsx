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
      tasks: [{ id: 't1', title: '回覆設計師', loc: '', date: '', time: '', done: false }],
      places: [{ id: 'p1', name: '秋紅谷公園', cat: 'park', address: '', hours: '', note: '', url: '' }],
    })
  })

  it('Ctrl+K 開啟，選到待辦後跳到待辦頁並開啟編輯', () => {
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    )
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = screen.getByPlaceholderText('搜尋行程、待辦、記帳或地點…')
    fireEvent.change(input, { target: { value: '設計師' } })
    expect(screen.queryByText('秋紅谷公園')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('回覆設計師'))
    expect(screen.getByTestId('path')).toHaveTextContent('/tasks')
    expect(screen.getByRole('dialog', { name: '編輯待辦' })).toBeInTheDocument()
  })
})
