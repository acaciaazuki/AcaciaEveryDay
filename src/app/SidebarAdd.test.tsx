import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { useConsentStore } from '../store/useConsentStore'
import { useSpacesStore } from '../store/useSpacesStore'
import { Layout } from './Layout'

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '/', Component: Layout, children: [{ path: 'tasks', element: <p>稍後辦內容</p> }] }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return screen.getByRole('complementary')
}

describe('側邊欄的「＋ 新增安排」主按鈕', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useConsentStore.setState({ status: 'accepted', record: null, pending: [] })
    const { selfId } = useSpacesStore.getState()
    useSpacesStore.setState({ viewerId: selfId })
  })

  it('在品牌標誌與搜尋框之間，任何頁面都能直接開啟新增行程視窗', () => {
    const aside = renderAt('/tasks')
    const btn = within(aside).getByRole('button', { name: '＋ 新增安排' })
    expect(btn).toHaveClass('w-full', 'bg-sage')
    expect(btn.nextElementSibling).toHaveTextContent('搜尋')
    fireEvent.click(btn)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('預覽其他成員的視角（唯讀）時不顯示', () => {
    useSpacesStore.setState({ viewerId: 'someone-else' })
    const aside = renderAt('/tasks')
    expect(within(aside).queryByRole('button', { name: '＋ 新增安排' })).not.toBeInTheDocument()
  })
})
