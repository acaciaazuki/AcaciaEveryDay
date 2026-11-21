import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { PlacesPage } from './PlacesPage'

describe('PlacesPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('搜尋地點後自動帶入資訊並儲存', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          places: [
            {
              displayName: { text: '小日子手沖咖啡' },
              formattedAddress: '台中市西屯區逢甲路',
              types: ['cafe'],
              regularOpeningHours: { weekdayDescriptions: ['星期一: 休息', '星期二: 10:00–18:00'] },
              rating: 4.6,
              userRatingCount: 120,
            },
          ],
        }),
      ),
    )
    render(<MemoryRouter><PlacesPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('＋ 新增地點'))
    fireEvent.change(screen.getByLabelText(/^搜尋地點（/), { target: { value: '小日子' } })
    fireEvent.click(screen.getByText('搜尋'))
    await waitFor(() => expect(screen.getByLabelText('地點名稱')).toHaveValue('小日子手沖咖啡'))
    expect(within(screen.getByRole('dialog')).getByLabelText('分類')).toHaveTextContent('咖啡')
    expect(screen.getByLabelText('營業時間與公休')).toHaveValue('公休時間：星期一\n星期一: 休息\n星期二: 10:00–18:00')
    fireEvent.click(screen.getByText('儲存'))
    expect(useAppStore.getState().places[0]).toMatchObject({ name: '小日子手沖咖啡', cat: 'cafe', note: 'Google 評價：4.6 顆星（120 則評論）' })
  })

  it('分類篩選', () => {
    useAppStore.setState({
      places: [
        { id: '1', name: 'A 咖啡', cat: 'cafe', address: '', hours: '', note: '', url: '' },
        { id: '2', name: 'B 公園', cat: 'park', address: '', hours: '', note: '', url: '' },
      ],
    })
    render(<MemoryRouter><PlacesPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('radio', { name: '公園' }))
    expect(screen.queryByText('A 咖啡')).not.toBeInTheDocument()
    expect(screen.getByText('B 公園')).toBeInTheDocument()
  })
})
