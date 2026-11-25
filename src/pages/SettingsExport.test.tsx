import 'fake-indexeddb/auto'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { useConsentStore } from '../store/useConsentStore'
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

describe('設定頁：匯出行事曆', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useConsentStore.setState({ status: 'accepted', record: null, pending: [] })
    useAppStore.setState({
      ...emptyAppData(),
      events: [
        { id: 'p1', title: '牙醫', dateISO: '2026-11-25', start: '14:00', end: '15:00', note: '' },
        { id: 'p2', title: '已刪除的', dateISO: '2026-11-26', start: '', end: '', note: '', deletedAt: Date.now() },
      ],
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('.ics：只包含我的行事曆，不含最近刪除；設定頁沒有共享空間匯出', async () => {
    const files = captureDownloads()
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /匯出共享空間/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '匯出行事曆（.ics）' }))
    expect(files[0]!.name).toMatch(/^acacia-calendar-\d{4}-\d{2}-\d{2}\.ics$/)
    expect(files[0]!.type).toBe('text/calendar;charset=utf-8')
    const ics = (await files[0]!.text).replace(/\r\n /g, '')
    expect(ics).toContain('SUMMARY:牙醫')
    expect(ics).toContain('DTSTART:20261125T140000')
    expect(ics).not.toContain('已刪除的')
  })
})
