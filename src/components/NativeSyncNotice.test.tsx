import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setNativeForTests } from '../adapters/kv'
import i18n from '../i18n'
import { useSyncStore } from '../store/useSyncStore'
import { BackupPanel } from './BackupPanel'
import { SyncPanel } from './SyncPanel'

const signIn = vi.fn()
vi.mock('../adapters/googleAuth', () => ({
  restoreToken: () => ({ token: 'tok', expiresAt: Date.now() + 3600_000 }),
  signIn: (...args: unknown[]) => signIn(...args),
  signOut: async () => {},
  fetchProfile: async () => ({ name: 'QQ' }),
}))

describe('iOS App：Google 登入不可用時的提示', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useSyncStore.setState({ status: 'signedOut', token: null, profile: null })
    signIn.mockReset()
  })
  afterEach(() => setNativeForTests(null))

  it('網頁版：照常顯示「Google 登入同步」', () => {
    setNativeForTests(false)
    render(<SyncPanel showHelp />)
    expect(screen.getByRole('button', { name: 'Google 登入同步' })).toBeInTheDocument()
    expect(document.querySelector('[data-native-sync-notice]')).toBeNull()
  })

  it('iOS：不顯示登入按鈕，改成說明只有本機與 iCloud 備份有效', () => {
    setNativeForTests(true)
    render(<SyncPanel showHelp />)
    expect(screen.queryByRole('button', { name: 'Google 登入同步' })).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('只存在這台 iPhone（隨 iCloud 備份）')
    expect(screen.getByRole('note')).toHaveTextContent('iOS App 目前不支援 Google 登入，只有本機資料與 iCloud 備份有效')
  })

  it('iOS：啟動時也不嘗試 Google 登入（即使有殘留的 token）', async () => {
    setNativeForTests(true)
    await useSyncStore.getState().connect(true)
    expect(signIn).not.toHaveBeenCalled()
    expect(useSyncStore.getState()).toMatchObject({ status: 'signedOut', token: null })
  })

  it('iOS：自動備份的雲端備份槽也說明只存在這台 iPhone', () => {
    setNativeForTests(true)
    render(<BackupPanel />)
    expect(screen.getByText('iOS App 不支援；快照存在這台 iPhone，並隨 iCloud 備份')).toBeInTheDocument()
    expect(screen.queryByText(/請先登入/)).toBeNull()
  })
})
