import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { useConsentStore } from '../store/useConsentStore'
import { Layout } from './Layout'

function renderAt(path: string) {
  const router = createMemoryRouter(
    [{ path: '/', Component: Layout, children: [{ path: 'calendar', element: <p>行事曆內容</p> }, { path: 'tasks', element: <p>稍後辦內容</p> }] }],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return screen.getByRole('main')
}

describe('行事曆頁撐滿視窗高度', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useConsentStore.setState({ status: 'accepted', record: null, pending: [] })
  })

  it('行事曆：所有寬度都是至少一個視窗高的直向 flex；手機底部預留導覽列與安全區域，平板以上留白 24px', () => {
    const main = renderAt('/calendar')
    expect(main).toHaveClass('flex', 'min-h-dvh', 'flex-col', 'pb-[calc(72px+env(safe-area-inset-bottom))]', 'min-[681px]:pb-6')
    expect(main.className).not.toMatch(/min-\[1001px\]:flex|min-\[1001px\]:min-h-dvh/)
  })

  it('其他頁面維持原本的自然高度與底部內距', () => {
    const main = renderAt('/tasks')
    expect(main).not.toHaveClass('min-h-dvh')
    expect(main).toHaveClass('pb-[calc(88px+env(safe-area-inset-bottom))]', 'min-[681px]:pb-16')
  })
})
