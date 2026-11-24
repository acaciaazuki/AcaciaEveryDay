import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getLocationAdapter, setLocationAdapter, webLocation, type LocationAdapter } from '../adapters/geofence'
import { emptyAppData, type Place } from '../core/schema'
import i18n from '../i18n'
import { useAppStore } from '../store/useAppStore'
import { useConsentStore } from '../store/useConsentStore'
import { PlacesPage } from './PlacesPage'

const place = (id: string, patch: Partial<Place> = {}): Place => ({ id, name: id, cat: 'other', address: '', hours: '', note: '', url: '', ...patch })

/** 畫面上卡片的地點名稱順序 */
const cards = () => [...document.querySelectorAll('ul > li strong')].map((el) => el.textContent)
const renderPage = () => render(<MemoryRouter><PlacesPage /></MemoryRouter>)

function fakeLocation(result: { lat: number; lng: number } | 'denied' | 'unavailable', permission: 'granted' | 'prompt' = 'prompt') {
  const getCurrent = vi.fn(() => (typeof result === 'string' ? Promise.reject(result) : Promise.resolve({ ...result, accuracy: 10 })))
  const adapter: LocationAdapter = { supported: true, watch: () => () => {}, getCurrent, permission: async () => permission }
  setLocationAdapter(adapter)
  return getCurrent
}

describe('最愛地點排序', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useConsentStore.setState({ status: 'accepted' })
    useAppStore.setState({
      ...emptyAppData(),
      places: [
        place('台北公園', { cat: 'park', lat: 25.04, lng: 121.51, hours: '星期一: 休息' }),
        place('台中咖啡', { cat: 'cafe', lat: 24.15, lng: 120.67 }),
        place('信義餐廳', { cat: 'restaurant', lat: 25.034, lng: 121.565, hours: '星期一: 24 小時營業' }),
        place('沒座標小吃', { cat: 'restaurant' }),
      ],
    })
  })
  afterEach(() => {
    setLocationAdapter(webLocation)
    vi.useRealTimers()
  })

  it('預設是自訂順序（資料本身的順序）', () => {
    renderPage()
    expect(screen.getByRole('radio', { name: '自訂順序' })).toHaveAttribute('aria-checked', 'true')
    expect(cards()).toEqual(['台北公園', '台中咖啡', '信義餐廳', '沒座標小吃'])
  })

  it('依種類排序並記住選擇', () => {
    renderPage()
    fireEvent.click(screen.getByRole('radio', { name: '種類' }))
    expect(cards()).toEqual(['信義餐廳', '沒座標小吃', '台中咖啡', '台北公園'])
    expect(useAppStore.getState().settings.placeSort).toBe('category')
  })

  it('匯出（備份與同步用同一份資料）再匯入後，自訂順序、排序方式與座標都還在', () => {
    useAppStore.getState().reorderPlaces(['沒座標小吃', '信義餐廳'])
    useAppStore.getState().setPlaceSort('open')
    const json = JSON.parse(JSON.stringify(useAppStore.getState().exportData()))
    useAppStore.setState(emptyAppData())
    useAppStore.getState().importData(json)
    const s = useAppStore.getState()
    expect(s.places.map((p) => p.id)).toEqual(['沒座標小吃', '信義餐廳', '台北公園', '台中咖啡'])
    expect(s.settings.placeSort).toBe('open')
    expect(s.places.find((p) => p.id === '信義餐廳')).toMatchObject({ lat: 25.034, lng: 121.565 })
  })

  it('依距離：使用者選了才定位，由近到遠，沒座標的排最後並標示', async () => {
    const getCurrent = fakeLocation({ lat: 25.033, lng: 121.5654 })
    renderPage()
    expect(getCurrent).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('radio', { name: '距離遠近' }))
    await waitFor(() => expect(cards()).toEqual(['信義餐廳', '台北公園', '台中咖啡', '沒座標小吃']))
    expect(getCurrent).toHaveBeenCalledTimes(1)
    expect(screen.getByText('距離未知')).toBeInTheDocument()
    expect(screen.getByText(/有 1 個地點沒有座標/)).toBeInTheDocument()
  })

  it('依距離：拒絕定位時明確提示並退回自訂順序', async () => {
    fakeLocation('denied')
    renderPage()
    fireEvent.click(screen.getByRole('radio', { name: '距離遠近' }))
    await screen.findByText(/沒有定位權限/)
    expect(cards()).toEqual(['台北公園', '台中咖啡', '信義餐廳', '沒座標小吃'])
    expect(screen.getByRole('button', { name: '再試一次' })).toBeInTheDocument()
  })

  it('依距離：還沒同意隱私權政策時不啟動定位', async () => {
    useConsentStore.setState({ status: 'required' })
    const getCurrent = fakeLocation({ lat: 25, lng: 121 })
    renderPage()
    fireEvent.click(screen.getByRole('radio', { name: '距離遠近' }))
    await screen.findByText(/同意隱私權政策後才能使用定位/)
    expect(getCurrent).not.toHaveBeenCalled()
  })

  it('記住「距離」時：沒允許過定位就不自動詢問，等使用者按按鈕', async () => {
    useAppStore.getState().setPlaceSort('distance')
    const getCurrent = fakeLocation({ lat: 25.033, lng: 121.5654 }, 'prompt')
    renderPage()
    expect(screen.getByText(/依距離排序需要目前位置/)).toBeInTheDocument()
    await act(async () => {})
    expect(getCurrent).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '使用目前位置' }))
    await waitFor(() => expect(cards()[0]).toBe('信義餐廳'))
  })

  it('記住「距離」且已允許定位時自動排序', async () => {
    useAppStore.getState().setPlaceSort('distance')
    fakeLocation({ lat: 25.033, lng: 121.5654 }, 'granted')
    renderPage()
    await waitFor(() => expect(cards()[0]).toBe('信義餐廳'))
    expect(getLocationAdapter()).not.toBe(webLocation)
  })

  it('依今日營業：營業中排前面，沒有資料的標示未知', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 23, 12, 0)) // 星期一中午
    renderPage()
    fireEvent.click(screen.getByRole('radio', { name: '今日營業' }))
    expect(cards()).toEqual(['信義餐廳', '台北公園', '台中咖啡', '沒座標小吃'])
    expect(screen.getByText('營業中')).toBeInTheDocument()
    expect(screen.getByText('今日公休')).toBeInTheDocument()
    expect(screen.getAllByText('營業時間未知')).toHaveLength(2)
  })

  it('排序列：排序：自訂順序 → 調整順序 → 種類 → 距離遠近 → 今日營業，同一個 gap、垂直置中，右側留空', () => {
    renderPage()
    const group = screen.getByRole('radiogroup', { name: '排序' })
    const row = group.parentElement!
    expect(row).toHaveAttribute('data-place-sort-row')
    expect(row).toHaveClass('flex', 'flex-wrap', 'items-center', 'gap-2')
    // 選項直接參與外層 flex，才能跟「調整順序」穿插排列
    expect(group).toHaveClass('contents')
    const reorder = screen.getByRole('button', { name: '調整順序' })
    expect(reorder).not.toHaveClass('ml-auto')
    expect(within(group).queryByRole('button', { name: '調整順序' })).toBeNull()
    // 依 CSS order 排出畫面上的順序（同 order 依原本的 DOM 順序）
    const orderOf = (el: Element) => Number(el.className.match(/(?:^|\s)order-(\d+)/)?.[1] ?? 0)
    const items = [...row.querySelectorAll('[role="radio"], [data-place-sort-row] > button')]
    const visual = items.map((el, i) => ({ el, i })).sort((a, b) => orderOf(a.el) - orderOf(b.el) || a.i - b.i).map(({ el }) => el.textContent)
    expect(visual).toEqual(['自訂順序', '調整順序', '種類', '距離遠近', '今日營業'])
  })

  it('調整順序：上下按鈕移動後存進資料，並切回自訂順序', () => {
    useAppStore.getState().setPlaceSort('category')
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '調整順序' }))
    expect(useAppStore.getState().settings.placeSort).toBe('custom')
    const list = screen.getByRole('list', { name: '調整自訂順序' })
    fireEvent.click(within(list).getByRole('button', { name: '下移「台北公園」' }))
    expect(useAppStore.getState().places.map((p) => p.id)).toEqual(['台中咖啡', '台北公園', '信義餐廳', '沒座標小吃'])
    // 鍵盤：把手上按 ↑
    fireEvent.keyDown(within(list).getByRole('button', { name: '拖曳調整「沒座標小吃」的順序' }), { key: 'ArrowUp' })
    expect(useAppStore.getState().places.map((p) => p.id)).toEqual(['台中咖啡', '台北公園', '沒座標小吃', '信義餐廳'])
    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(cards()).toEqual(['台中咖啡', '台北公園', '沒座標小吃', '信義餐廳'])
  })

  it('重新排序會更新 updatedAt，讓同步上傳新順序', () => {
    useAppStore.setState({ updatedAt: 1 })
    useAppStore.getState().reorderPlaces(['信義餐廳'])
    const s = useAppStore.getState()
    expect(s.places.map((p) => p.id)).toEqual(['信義餐廳', '台北公園', '台中咖啡', '沒座標小吃'])
    expect(s.updatedAt).toBeGreaterThan(1)
  })
})

describe('地點表單的座標', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('貼上地圖連結會存成座標；看不懂時提示', () => {
    renderPage()
    fireEvent.click(screen.getByText('＋ 新增地點'))
    fireEvent.change(screen.getByLabelText('地點名稱'), { target: { value: '小店' } })
    const coords = screen.getByLabelText('座標（選填，依距離排序用）')
    fireEvent.change(coords, { target: { value: '不是座標' } })
    fireEvent.click(screen.getByText('儲存'))
    expect(screen.getByText(/看不懂這個座標/)).toBeInTheDocument()
    fireEvent.change(coords, { target: { value: 'https://www.google.com/maps/place/x/@25.0478,121.517,17z' } })
    fireEvent.click(screen.getByText('儲存'))
    expect(useAppStore.getState().places[0]).toMatchObject({ name: '小店', lat: 25.0478, lng: 121.517 })
  })

  it('搜尋結果有座標時一起帶入', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ places: [{ displayName: { text: '春水堂' }, formattedAddress: '台中市', types: ['cafe'], location: { latitude: 24.1, longitude: 120.6 } }] })))
    renderPage()
    fireEvent.click(screen.getByText('＋ 新增地點'))
    fireEvent.change(screen.getByLabelText(/^搜尋地點（/), { target: { value: '春水堂' } })
    fireEvent.click(screen.getByText('搜尋'))
    await waitFor(() => expect(screen.getByLabelText('座標（選填，依距離排序用）')).toHaveValue('24.1, 120.6'))
    fireEvent.click(screen.getByText('儲存'))
    expect(useAppStore.getState().places[0]).toMatchObject({ lat: 24.1, lng: 120.6 })
  })
})
