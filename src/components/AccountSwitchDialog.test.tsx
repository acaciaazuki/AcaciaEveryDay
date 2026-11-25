import 'fake-indexeddb/auto'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { useSyncStore } from '../store/useSyncStore'
import { AccountSwitchDialog } from './AccountSwitchDialog'
import { SyncPanel } from './SyncPanel'

const resolve = vi.fn(async () => {})

describe('登入不同 Google 帳號的確認對話框', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    resolve.mockClear()
    useSyncStore.setState({ status: 'confirmAccount', token: null, profile: null, accountSwitch: { name: 'B 帳號' }, resolveAccountSwitch: resolve })
  })

  it('沒有待確認的帳號時不顯示', () => {
    useSyncStore.setState({ status: 'signedOut', accountSwitch: null })
    render(<AccountSwitchDialog />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('顯示新帳號名稱，預設聚焦在「切換至此帳號」', () => {
    render(<AccountSwitchDialog />)
    expect(screen.getByRole('dialog')).toHaveTextContent('這次登入的帳號（B 帳號）跟這台裝置上次同步的帳號不同')
    expect(document.activeElement).toBe(document.querySelector('[data-account-choice="switch"]'))
  })

  it.each(['switch', 'merge', 'cancel'] as const)('按下 %s 會回報對應選擇', (choice) => {
    render(<AccountSwitchDialog />)
    fireEvent.click(document.querySelector(`[data-account-choice="${choice}"]`)!)
    expect(resolve).toHaveBeenCalledWith(choice)
  })

  it('按 Esc 關閉等同取消', () => {
    render(<AccountSwitchDialog />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(resolve).toHaveBeenCalledWith('cancel')
  })

  it('等待確認時，同步面板顯示提示且停用登入按鈕', () => {
    render(<SyncPanel />)
    expect(screen.getByRole('status')).toHaveTextContent('等待確認要使用的 Google 帳號…')
    expect(screen.getByRole('button', { name: 'Google 登入同步' })).toBeDisabled()
  })
})
