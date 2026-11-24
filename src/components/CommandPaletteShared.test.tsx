import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { CalendarPage } from '../pages/CalendarPage'
import { useAppStore } from '../store/useAppStore'
import { useSpacesStore } from '../store/useSpacesStore'
import { U } from '../test/sharingFixtures'
import { LEAK, loadSeed, SEEN } from '../test/spacesSeed'
import { CommandPalette } from './CommandPalette'

const leakRe = new RegExp(Object.values(LEAK).join('|'))

function Harness() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} />
      <Routes>
        <Route path="/" element={null} />
        <Route path="/calendar" element={<CalendarPage />} />
      </Routes>
    </>
  )
}

const renderPalette = () => render(<MemoryRouter><Harness /></MemoryRouter>)
const search = (q: string) => fireEvent.change(screen.getByPlaceholderText(/搜尋/), { target: { value: q } })
const results = () => screen.queryAllByRole('option').map((o) => o.textContent ?? '')

describe('⌘K 搜尋：共享行程的權限邊界', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState({ ...emptyAppData(), events: [{ id: 'p1', title: '我的私人瑜珈', dateISO: '2026-12-01', start: '07:00', end: '08:00', note: '' }] })
    loadSeed(U.dad, '2026-12-01')
  })

  it('本人：可以搜到自己的共享行程（含地點），結果標出空間', () => {
    renderPalette()
    search('台大')
    expect(results()).toHaveLength(1)
    expect(results()[0]).toContain(LEAK.clinicTitle)
    expect(results()[0]).toContain('陳家')
    search('驚喜')
    expect(results()).toEqual([])
  })

  it('預覽小孩：忙碌、被隱藏、別的空間的行程與遮罩欄位都搜不到', () => {
    act(() => {
      useSpacesStore.getState().setViewer(U.kid)
    })
    renderPalette()
    for (const q of ['腫瘤', '台大', '外出', '上班中', '併購', '32F', '年終', '回鄉祕密', '紅包', '瑜珈']) {
      search(q)
      expect(results(), q).toEqual([])
    }
    // 遮罩只遮標題與備註：地點仍可搜，標題顯示「已隱藏」
    search('台南')
    expect(results()).toHaveLength(1)
    expect(results()[0]).toContain('（已隱藏）')
    expect(results()[0]).not.toMatch(leakRe)
    // 白名單內的驚喜可以搜到
    search('驚喜')
    expect(results()[0]).toContain(SEEN.surprise)
  })

  it('選擇共享行程的結果會開啟行事曆；預覽中只開唯讀詳情', () => {
    act(() => {
      useSpacesStore.getState().setViewer(U.kid)
    })
    renderPalette()
    search('台南')
    fireEvent.click(screen.getByRole('option'))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(SEEN.homePlace)).toBeInTheDocument()
    expect(within(dialog).queryByText('儲存')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(leakRe)
  })
})
