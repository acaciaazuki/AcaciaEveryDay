import { del, get, set } from 'idb-keyval'
import type { StateStorage } from 'zustand/middleware'

/**
 * 儲存轉接層。網頁版用 IndexedDB；之後 iOS（Capacitor）換成 Preferences / SQLite，
 * 只要實作同樣的介面，store 與畫面不用改。
 */
export const webStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: (name, value) => set(name, value),
  removeItem: (name) => del(name),
}
