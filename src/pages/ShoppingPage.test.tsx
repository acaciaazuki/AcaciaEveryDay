import 'fake-indexeddb/auto'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { ShoppingPage } from './ShoppingPage'

describe('ShoppingPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
  })

  it('新增自訂分類的記帳', () => {
    render(<MemoryRouter><ShoppingPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('＋ 新增記帳'))
    fireEvent.change(screen.getByLabelText('購買項目'), { target: { value: '貓砂' } })
    fireEvent.change(screen.getByLabelText('金額'), { target: { value: '300' } })
    fireEvent.change(screen.getByLabelText('分類'), { target: { value: 'other' } })
    fireEvent.change(screen.getByLabelText('自訂分類名稱'), { target: { value: '寵物' } })
    fireEvent.click(screen.getByText('儲存'))
    expect(useAppStore.getState().shopping[0]).toMatchObject({ title: '貓砂', amt: 300, cat: 'other', customCat: '寵物' })
    expect(screen.getByText(/寵物: /)).toBeInTheDocument()
  })
})
