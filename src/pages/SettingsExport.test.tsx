import 'fake-indexeddb/auto'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { useConsentStore } from '../store/useConsentStore'
import { useSpacesStore } from '../store/useSpacesStore'
import { SettingsPage } from './SettingsPage'

/** 攔截下載：記下檔名與內容 */
function captureDownloads() {
  const files: { name: string; type: string; text: Promise<string> }[] = []
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    const b = blob as Blob
    files.push({ name: '', type: b.type, text: b.text() })
    return 'blob:x'
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    files[files.length - 1]!.name = this.download
  })
  return files
}

describe('設定頁：匯出行事曆與共享空間', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useConsentStore.setState({ status: 'accepted', record: null, pending: [] })
    useSpacesStore.getState().reset()
    useAppStore.setState({
      ...emptyAppData(),
      events: [
        { id: 'p1', title: '牙醫', dateISO: '2026-11-25', start: '14:00', end: '15:00', note: '' },
        { id: 'p2', title: '已刪除的', dateISO: '2026-11-26', start: '', end: '', note: '', deletedAt: Date.now() },
      ],
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('.ics：包含我的行事曆與看得到的共享行程（含空間名稱分類），不含最近刪除', async () => {
    const sp = useSpacesStore.getState()
    const family = sp.createSpace({ name: '陳家', kind: 'family' })
    sp.addItem(family, { kind: 'event', title: '家庭聚餐', dateISO: '2026-11-27', start: '18:00', end: '20:00', location: '外婆家' })
    const files = captureDownloads()
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '匯出行事曆（.ics）' }))
    expect(files[0]!.name).toMatch(/^acacia-calendar-\d{4}-\d{2}-\d{2}\.ics$/)
    expect(files[0]!.type).toBe('text/calendar;charset=utf-8')
    const ics = (await files[0]!.text).replace(/\r\n /g, '')
    expect(ics).toContain('SUMMARY:牙醫')
    expect(ics).toContain('SUMMARY:家庭聚餐')
    expect(ics).toContain('LOCATION:外婆家')
    expect(ics).toContain('CATEGORIES:陳家')
    expect(ics).not.toContain('已刪除的')
  })

  it('共享空間 JSON：自己看得到的同步封包與自己的投射規則', async () => {
    const sp = useSpacesStore.getState()
    const family = sp.createSpace({ name: '陳家', kind: 'family' })
    sp.addItem(family, { kind: 'event', title: '家庭聚餐', dateISO: '2026-11-27', start: '18:00', end: '20:00' })
    const files = captureDownloads()
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '匯出共享空間（JSON）' }))
    expect(files[0]!.name).toMatch(/^acacia-spaces-\d{4}-\d{2}-\d{2}\.json$/)
    const json = JSON.parse(await files[0]!.text) as { format: string; viewerId: string; spaces: { space: { name: string }; entries: { title: string }[] }[] }
    expect(json.format).toBe('acacia-spaces-export')
    expect(json.viewerId).toBe(useSpacesStore.getState().selfId)
    expect(json.spaces[0]!.space.name).toBe('陳家')
    expect(json.spaces[0]!.entries.map((e) => e.title)).toEqual(['家庭聚餐'])
  })
})
