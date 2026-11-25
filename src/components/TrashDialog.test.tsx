import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { emptyAppData, type CalendarEvent } from '../core/schema'
import { TRASH_RETENTION_MS } from '../core/trash'
import { useAppStore } from '../store/useAppStore'
import { useToastStore } from '../store/useToastStore'
import { EventDialog } from './EventDialog'
import { GlobalToast } from './GlobalToast'
import { TrashDialog } from './TrashDialog'

const DAY = 24 * 60 * 60 * 1000
const dentist: CalendarEvent = { id: 'p1', title: '牙醫', dateISO: '2026-11-25', start: '14:00', end: '15:00', note: '' }

describe('最近刪除（畫面）', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState({ ...emptyAppData(), events: [dentist] })
    useToastStore.getState().clear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('行程對話框按刪除：移到最近刪除，提示可以直接復原', () => {
    // 跟真的畫面一樣：按刪除後對話框關閉，提示留在頁面上
    function Page() {
      const [open, setOpen] = useState(true)
      return (
        <MemoryRouter>
          {open && <EventDialog event={dentist} onClose={() => setOpen(false)} />}
          <GlobalToast />
        </MemoryRouter>
      )
    }
    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: '刪除' }))
    expect(useAppStore.getState().events[0]!.deletedAt).toEqual(expect.any(Number))
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('已移到最近刪除，30 天後自動永久刪除')
    fireEvent.click(within(toast).getByRole('button', { name: '復原' }))
    expect(useAppStore.getState().events[0]!.deletedAt).toBeUndefined()
  })

  it('列出刪除的行程與剩餘天數；可以還原', () => {
    useAppStore.setState({ events: [{ ...dentist, deletedAt: Date.now() - DAY }] })
    render(<TrashDialog onClose={() => {}} />)

    const item = document.querySelector('[data-trash-item="p1"]') as HTMLElement
    expect(item).toHaveTextContent('牙醫')
    expect(item).toHaveTextContent('剩餘 29 天')
    // 沒有共享，不顯示「由誰刪除」
    expect(item).not.toHaveTextContent(/由.*刪除/)

    fireEvent.click(within(item).getByRole('button', { name: '還原' }))
    expect(useAppStore.getState().events[0]!.deletedAt).toBeUndefined()
    expect(document.querySelector('[data-trash-empty]')).toBeInTheDocument()
  })

  it('永久刪除要先確認；取消就不刪', () => {
    useAppStore.setState({ events: [{ ...dentist, deletedAt: Date.now() }] })
    render(<TrashDialog onClose={() => {}} />)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    fireEvent.click(screen.getByRole('button', { name: '永久刪除' }))
    expect(useAppStore.getState().events).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '永久刪除' }))
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(useAppStore.getState().events).toEqual([])
  })

  it('打開時清掉滿 30 天的', () => {
    useAppStore.setState({ events: [{ ...dentist, deletedAt: Date.now() - TRASH_RETENTION_MS }] })
    render(<TrashDialog onClose={() => {}} />)
    act(() => {})
    expect(useAppStore.getState().events).toEqual([])
    expect(document.querySelector('[data-trash-empty]')).toBeInTheDocument()
  })
})
