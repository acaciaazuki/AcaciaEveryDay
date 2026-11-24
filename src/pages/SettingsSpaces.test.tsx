import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { useSpacesStore } from '../store/useSpacesStore'
import { setSpacesSyncProvider, useSpacesSyncStore } from '../store/useSpacesSyncStore'
import { useSyncStore } from '../store/useSyncStore'
import { createDriveSyncProvider } from '../adapters/sync/driveSyncProvider'
import { fakeDrive } from '../test/fakeDrive'
import { SettingsPage } from './SettingsPage'

const renderPage = () => render(<MemoryRouter><SettingsPage /></MemoryRouter>)
const panel = () => screen.getByRole('heading', { name: '共享空間' }).closest('section')!

describe('設定：共享空間', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
    useSpacesStore.getState().reset()
  })

  it('新增空間（自訂名稱與類型）、模擬成員與角色', () => {
    renderPage()
    const p = within(panel())
    expect(p.getByText('還沒有共享空間')).toBeInTheDocument()
    fireEvent.click(p.getByRole('button', { name: '新增空間' }))
    expect(p.getByRole('alert')).toHaveTextContent('請輸入空間名稱')

    fireEvent.change(p.getByLabelText('空間名稱'), { target: { value: '陳家' } })
    fireEvent.change(p.getByLabelText('類型'), { target: { value: 'family' } })
    fireEvent.click(p.getByRole('button', { name: '新增空間' }))
    const card = within(p.getByRole('group', { name: '陳家' }))
    expect(card.getByText('家人')).toBeInTheDocument()
    expect(card.getByText('我')).toBeInTheDocument()

    fireEvent.change(card.getByLabelText('成員名稱'), { target: { value: '媽媽' } })
    fireEvent.change(card.getByLabelText('角色'), { target: { value: 'editor' } })
    fireEvent.click(card.getByRole('button', { name: '新增成員' }))
    expect(card.getByText('媽媽')).toBeInTheDocument()
    fireEvent.change(card.getByLabelText('媽媽 的角色'), { target: { value: 'viewer' } })
    const space = useSpacesStore.getState().data.spaces[0]!
    expect(space).toMatchObject({ name: '陳家', kind: 'family' })
    expect(space.members.find((m) => m.displayName === '媽媽')?.role).toBe('viewer')
  })

  it('兩個以上空間時可以設定忙閒投射規則', () => {
    const st = useSpacesStore.getState()
    const family = st.createSpace({ name: '陳家', kind: 'family' })
    const work = st.createSpace({ name: '設計部', kind: 'work' })
    renderPage()
    const p = within(panel())
    fireEvent.change(p.getByLabelText('來源空間'), { target: { value: work } })
    fireEvent.change(p.getByLabelText('顯示在'), { target: { value: family } })
    fireEvent.change(p.getAllByLabelText('忙碌時顯示的文字').at(-1)!, { target: { value: '上班中' } })
    fireEvent.click(p.getByRole('button', { name: '新增規則' }))
    expect(p.getByText('設計部 → 陳家：顯示「上班中」')).toBeInTheDocument()
    expect(useSpacesStore.getState().data.busyProjectionRules[0]).toMatchObject({ sourceSpaceId: work, targetSpaceId: family, label: '上班中', enabled: true })

    fireEvent.click(p.getByLabelText('啟用'))
    expect(useSpacesStore.getState().data.busyProjectionRules[0]!.enabled).toBe(false)
  })

  it('刪除空間要確認', () => {
    useSpacesStore.getState().createSpace({ name: '舊社團', kind: 'personal' })
    renderPage()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(within(panel()).getByRole('button', { name: '刪除空間' }))
    expect(confirm).toHaveBeenCalled()
    expect(within(panel()).getByText('還沒有共享空間')).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('預覽其他成員時，設定頁只能看不能改', () => {
    const st = useSpacesStore.getState()
    const id = st.createSpace({ name: '陳家', kind: 'family' })
    const mom = st.addMember(id, { displayName: '媽媽', role: 'editor' })
    st.setViewer(mom)
    renderPage()
    const p = within(panel())
    expect(p.getByText('預覽其他成員的視角時只能查看')).toBeInTheDocument()
    expect(p.getByRole('button', { name: '新增空間' })).toBeDisabled()
    expect(p.queryByRole('button', { name: '新增成員' })).not.toBeInTheDocument()
  })
})

describe('設定：共享空間雲端同步', () => {
  let drive = fakeDrive()
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
    useSpacesStore.getState().reset()
    useSpacesStore.getState().createSpace({ name: '陳家', kind: 'family' })
    drive = fakeDrive()
    setSpacesSyncProvider(createDriveSyncProvider({ getToken: () => useSyncStore.getState().token, drive: drive.api, isOnline: () => true }))
    useSpacesSyncStore.setState({ state: 'idle', lastSyncedAt: null, error: null, conflicts: [] })
  })

  it('沒登入 Google 時不能開啟，並提示先登入', () => {
    useSyncStore.setState({ token: null, status: 'signedOut' })
    renderPage()
    const p = within(panel())
    expect(p.getByRole('switch', { name: '共享空間雲端同步' })).toBeDisabled()
    expect(p.getByText('未開啟，共享空間只存在這台裝置')).toBeInTheDocument()
    expect(p.getByText('請先在上方用 Google 登入同步')).toBeInTheDocument()
  })

  it('開啟後建立雲端檔案並顯示 24 小時制的同步時間；關閉可以選擇只停止或刪除（刪除要再確認一次）', async () => {
    useSyncStore.setState({ token: 'tok', status: 'synced' })
    renderPage()
    const p = within(panel())
    fireEvent.click(p.getByRole('switch', { name: '共享空間雲端同步' }))
    expect(await p.findByText(/^已同步 \d{2}:\d{2}$/)).toBeInTheDocument()
    expect(drive.files).toHaveProperty('acacia_spaces_v1.json')

    // 只停止：保留檔案
    fireEvent.click(p.getByRole('switch', { name: '共享空間雲端同步' }))
    let dialog = screen.getByRole('dialog', { name: '關閉共享空間雲端同步' })
    fireEvent.click(within(dialog).getByText('只停止同步（保留 Drive 上的檔案）'))
    expect(await p.findByText('已停止同步，Drive 上的檔案保留')).toBeInTheDocument()
    expect(drive.files).toHaveProperty('acacia_spaces_v1.json')
    expect(useSpacesStore.getState().cloudSync).toBe(false)

    // 停止並刪除：要再確認一次，取消就不刪
    fireEvent.click(p.getByRole('switch', { name: '共享空間雲端同步' }))
    await p.findByText(/^已同步/)
    fireEvent.click(p.getByRole('switch', { name: '共享空間雲端同步' }))
    dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByText('停止同步並刪除 Drive 上的檔案…'))
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('acacia_spaces_v1.json')
    fireEvent.click(within(screen.getByRole('dialog')).getByText('取消'))
    fireEvent.click(within(screen.getByRole('dialog')).getByText('停止同步並刪除 Drive 上的檔案…'))
    fireEvent.click(within(screen.getByRole('dialog')).getByText('刪除雲端檔案'))
    expect(await p.findByText('已停止同步，並刪除 Drive 上的檔案')).toBeInTheDocument()
    expect(drive.files).not.toHaveProperty('acacia_spaces_v1.json')
    // 這台裝置的共享空間還在
    expect(useSpacesStore.getState().data.spaces).toHaveLength(1)
  })

  it('共享空間快照：立即建立，清單顯示時間與數量', async () => {
    renderPage()
    const p = within(panel())
    fireEvent.click(p.getByRole('button', { name: '立即建立快照' }))
    expect(await p.findByText('已建立快照')).toBeInTheDocument()
    expect(within(p.getByRole('list', { name: '共享空間快照' })).getByText(/1 個空間、0 筆行程/)).toBeInTheDocument()
  })
})
