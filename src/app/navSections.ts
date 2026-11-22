import type { IconName } from '../core/icons'

export interface NavItem {
  /** 存在設定裡的識別碼，也是翻譯 nav.<key> 的 key；改名會讓使用者的排序失效，請勿隨意更動 */
  key: string
  to: string
  ico: IconName
}

/**
 * 可由使用者排序的側邊欄區塊。區塊名稱是 settings.navOrder 的 key。
 * 之後新增功能只要加進陣列，使用者已存的順序會自動把它補在最後；
 * 其他區塊要開放排序時，在這裡加一個區塊並在 Layout 用 useNavOrder 讀取即可。
 */
export const NAV_SECTIONS = {
  collect: [
    { key: 'shopping', to: '/shopping', ico: 'shopping' },
    { key: 'reminders', to: '/reminders', ico: 'reminders' },
    { key: 'subscriptions', to: '/subscriptions', ico: 'subscription' },
    { key: 'inventory', to: '/inventory', ico: 'inventory' },
  ],
} as const satisfies Record<string, readonly NavItem[]>

export type NavSection = keyof typeof NAV_SECTIONS
