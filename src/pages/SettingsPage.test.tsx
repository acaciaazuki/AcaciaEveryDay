import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { migrate } from '../core/migrate'
import { emptyAppData } from '../core/schema'
import { useFontScale } from '../hooks/useFontScale'
import { useAppStore } from '../store/useAppStore'
import { SettingsPage } from './SettingsPage'

function Harness() {
  useFontScale()
  return <SettingsPage />
}

describe('字體大小', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
    document.documentElement.style.removeProperty('--fs')
    localStorage.clear()
  })

  it('預設標準，點選後即時生效並存進資料', () => {
    render(<MemoryRouter><Harness /></MemoryRouter>)
    const group = screen.getByRole('radiogroup', { name: '字體大小' })
    expect(within(group).getAllByRole('radio').map((r) => r.textContent?.replace('', '').replace('Aa', ''))).toEqual(['小', '標準', '大', '特大'])
    expect(within(group).getByRole('radio', { name: /標準/ })).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement.style.getPropertyValue('--fs')).toBe('1')

    fireEvent.click(within(group).getByRole('radio', { name: /特大/ }))
    expect(within(group).getByRole('radio', { name: /特大/ })).toHaveAttribute('aria-checked', 'true')
    expect(within(group).getByRole('radio', { name: /標準/ })).toHaveAttribute('aria-checked', 'false')
    expect(useAppStore.getState().settings.fontSize).toBe('xl')
    expect(document.documentElement.style.getPropertyValue('--fs')).toBe('1.3')
    expect(localStorage.getItem('acacia_font_size')).toBe('xl')
    expect(useAppStore.getState().exportData().settings).toEqual({ fontSize: 'xl' })

    fireEvent.click(within(group).getByRole('radio', { name: /^小/ }))
    expect(document.documentElement.style.getPropertyValue('--fs')).toBe('0.9')
  })

  it('舊資料沒有 settings 時補標準，雲端資料的字體大小會被讀進來', () => {
    const { settings: _drop, ...old } = emptyAppData()
    void _drop
    expect(migrate(old).settings).toEqual({ fontSize: 'md' })
    expect(migrate({ ...emptyAppData(), settings: { fontSize: 'lg' } }).settings.fontSize).toBe('lg')
  })
})
