import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { useSpacesStore } from '../store/useSpacesStore'
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
