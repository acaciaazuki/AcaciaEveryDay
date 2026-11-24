import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { toLocalISO } from '../core/date'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { useSpacesStore } from '../store/useSpacesStore'
import { U } from '../test/sharingFixtures'
import { clearSpaces, LEAK, loadSeed, SEEN } from '../test/spacesSeed'
import { TodayPage } from './TodayPage'

const leakRe = new RegExp(Object.values(LEAK).join('|'))
const renderPage = () => render(<MemoryRouter><TodayPage /></MemoryRouter>)

describe('今日頁：共享行程的權限邊界', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState({ ...emptyAppData(), events: [{ id: 'p1', title: '我的私人瑜珈', dateISO: toLocalISO(), start: '07:00', end: '08:00', note: '' }] })
    loadSeed()
  })

  it('沒有共享空間時，節奏只算個人行程（跟原本一樣）', () => {
    clearSpaces()
    renderPage()
    expect(screen.getByText('已安排 1 小時')).toBeInTheDocument()
  })

  it('本人：時間軸顯示看得到的共享行程，節奏也算進去', () => {
    renderPage()
    expect(screen.getByText(SEEN.dinner)).toBeInTheDocument()
    expect(screen.getByText(LEAK.clinicTitle)).toBeInTheDocument()
    expect(screen.queryByText(SEEN.surprise)).not.toBeInTheDocument()
    // 瑜珈 1 + 就醫 2 + 回鄉 1 + 會議 2 + 聚餐 2 + 獎金 1 = 9 小時
    expect(screen.getByText('已安排 9 小時')).toBeInTheDocument()
    expect(screen.getByText('＋ 新增安排')).toBeInTheDocument()
  })

  it('預覽小孩：不顯示個人行程與敏感內容，忙碌時段照樣算進節奏', () => {
    useSpacesStore.getState().setViewer(U.kid)
    renderPage()
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(leakRe)
    expect(text).not.toContain('我的私人瑜珈')
    expect(screen.getByText('外出')).toBeInTheDocument()
    expect(screen.getByText('上班中')).toBeInTheDocument()
    expect(screen.getByText(SEEN.surprise)).toBeInTheDocument()
    // 就醫 2 + 回鄉 1 + 會議投射 2 + 聚餐 2 + 驚喜 1 = 8 小時
    expect(screen.getByText('已安排 8 小時')).toBeInTheDocument()
    expect(screen.queryByText('＋ 新增安排')).not.toBeInTheDocument()

    fireEvent.click(document.querySelector('[data-shared="clinic"]')!)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByText('儲存')).not.toBeInTheDocument()
    expect(dialog.textContent).not.toMatch(leakRe)
  })

  it('一週檢視也套用同樣的過濾', () => {
    useSpacesStore.getState().setViewer(U.kid)
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '一週' }))
    expect(document.body.textContent).not.toMatch(leakRe)
    expect(screen.getAllByText('外出').length).toBeGreaterThan(0)
  })
})
