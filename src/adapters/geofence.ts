import type { Fix } from '../core/reminders'

export type LocationError = 'denied' | 'unavailable' | 'timeout'

/**
 * 定位轉接層。網頁版用瀏覽器 Geolocation；之後打包成 iOS App（Capacitor）時，
 * 只要實作同樣的介面（改用原生的背景地理圍欄 / 定位外掛）再用 setLocationAdapter 換掉，
 * 提醒規則、進出判斷和畫面都不用改。
 */
export interface LocationAdapter {
  readonly supported: boolean
  /** 持續監看位置，回傳停止函式 */
  watch(onFix: (fix: Fix) => void, onError: (e: LocationError) => void): () => void
  /** 取得一次目前位置 */
  getCurrent(): Promise<Fix>
  /**
   * 目前的定位權限狀態（不會跳出詢問）。查不到時回傳 'unknown'。
   * 用來判斷能不能在不打擾使用者的情況下自動取得位置
   */
  permission?(): Promise<'granted' | 'prompt' | 'denied' | 'unknown'>
}

const toFix = (p: GeolocationPosition): Fix => ({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy })
const toError = (e: GeolocationPositionError): LocationError => (e.code === e.PERMISSION_DENIED ? 'denied' : e.code === e.TIMEOUT ? 'timeout' : 'unavailable')

export const webLocation: LocationAdapter = {
  get supported() {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator
  },
  watch(onFix, onError) {
    if (!this.supported) {
      onError('unavailable')
      return () => {}
    }
    const id = navigator.geolocation.watchPosition((p) => onFix(toFix(p)), (e) => onError(toError(e)), { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 })
    return () => navigator.geolocation.clearWatch(id)
  },
  getCurrent() {
    return new Promise((resolve, reject) => {
      if (!this.supported) return reject('unavailable' satisfies LocationError)
      navigator.geolocation.getCurrentPosition((p) => resolve(toFix(p)), (e) => reject(toError(e)), { enableHighAccuracy: true, timeout: 20_000 })
    })
  },
  async permission() {
    try {
      const r = await navigator.permissions?.query({ name: 'geolocation' })
      return r?.state ?? 'unknown'
    } catch {
      return 'unknown'
    }
  },
}

let current: LocationAdapter = webLocation
export const getLocationAdapter = () => current
export const setLocationAdapter = (a: LocationAdapter) => {
  current = a
}
