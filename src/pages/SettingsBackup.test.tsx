import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearBackups } from '../adapters/backupStorage'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { useBackupStore } from '../store/useBackupStore'
import { SettingsPage } from './SettingsPage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )

describe('設定頁：自動備份與刪除資料', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    await clearBackups()
    useBackupStore.getState().reset()
    useBackupStore.setState({ ready: false })
    useAppStore.setState(emptyAppData())
  })
  afterEach(() => vi.restoreAllMocks())

  it('預設開啟自動備份，可以關閉', async () => {
    renderPage()
    const sw = await screen.findByRole('switch', { name: '啟用自動備份' })
    await vi.waitFor(() => expect(sw).toBeEnabled())
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('backup-last')).toHaveTextContent('尚未備份')
    fireEvent.click(sw)
    await vi.waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'false'))
    expect(screen.getByText('自動備份已關閉，仍可手動備份。')).toBeInTheDocument()
  })

  it('立即備份後出現在歷史清單，確認後一鍵還原', async () => {
    useAppStore.getState().addTask({ title: '重要待辦', loc: '', date: '', time: '' })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '立即備份' }))
    const list = await screen.findByRole('list', { name: '歷史備份' })
    expect(within(list).getByText(/待辦 1/)).toBeInTheDocument()
    expect(screen.getByTestId('backup-last')).not.toHaveTextContent('尚未備份')

    // 誤刪後還原
    useAppStore.setState({ tasks: [], updatedAt: Date.now() + 1 })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(within(list).getByRole('button', { name: /^還原/ }))
    await screen.findByText(/已還原到/)
    expect(confirm).toHaveBeenCalledOnce()
    expect(useAppStore.getState().tasks[0].title).toBe('重要待辦')
    expect(within(screen.getByRole('list', { name: '歷史備份' })).getByText('還原前')).toBeInTheDocument()
  })

  it('取消確認時不還原', async () => {
    useAppStore.getState().addTask({ title: 'A', loc: '', date: '', time: '' })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '立即備份' }))
    const list = await screen.findByRole('list', { name: '歷史備份' })
    useAppStore.setState({ tasks: [], updatedAt: Date.now() + 1 })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(within(list).getByRole('button', { name: /^還原/ }))
    expect(useAppStore.getState().tasks).toEqual([])
  })

  it('刪除所有資料（未登入只清本機），並有隱私權政策連結', async () => {
    useAppStore.getState().addTask({ title: 'A', loc: '', date: '', time: '' })
    renderPage()
    expect(screen.getAllByRole('link', { name: '隱私權政策' })[0]).toHaveAttribute('href', '/privacy')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: '刪除所有資料' }))
    await screen.findByText('已刪除這台裝置上的所有資料')
    expect(useAppStore.getState().tasks).toEqual([])
  })
})
