import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { ShoppingPage } from './ShoppingPage'

describe('搜尋跳到已歸檔的記帳', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState({
      ...emptyAppData(),
      archives: [
        { start: '2026-09-10', end: '2026-10-09', archivedAt: 0, expenses: [{ id: 's2', title: '衛生紙', amt: 120, store: '全聯', cat: 'housing', date: '2026-09-20', time: '', done: false }] },
      ],
    })
  })

  it('不開編輯框，改在年度記帳本展開那一期並標出該筆', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/shopping?open=s2']}>
        <ShoppingPage />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const row = container.querySelector('[data-expense="s2"]')
    expect(row).toHaveClass('ring-2')
    expect(row?.closest('details')).toHaveAttribute('open')
  })
})
