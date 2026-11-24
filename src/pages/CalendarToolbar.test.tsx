import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { loadSeed } from '../test/spacesSeed'
import { CalendarPage } from './CalendarPage'

const renderPage = () => render(<MemoryRouter><CalendarPage /></MemoryRouter>)

describe('行事曆頂部工具列', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
    loadSeed()
  })

  it('頂部工具列放大：標題、按鈕、空間篩選、檢視身份都用較大的字級（跟著字體設定縮放）', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: '行事曆' })).toHaveClass('text-[length:calc(30px*var(--fs))]')
    for (const name of ['國定假日', '批次新增', '＋ 新增事件']) expect(screen.getByRole('button', { name })).toHaveClass('text-[length:calc(14px*var(--fs))]!')
    const tabs = screen.getByRole('tablist', { name: '顯示哪些行程' })
    for (const tab of within(tabs).getAllByRole('tab')) expect(tab).toHaveClass('text-[length:calc(14px*var(--fs))]')
    expect(screen.getByLabelText('檢視身份')).toHaveClass('text-[length:calc(14px*var(--fs))]')
  })
})
