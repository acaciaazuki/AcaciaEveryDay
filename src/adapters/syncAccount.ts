import { kv } from './kv'

/**
 * 「這台裝置上次同步的是哪個 Google 帳號」的紀錄，用來在登入不同帳號時先詢問使用者，
 * 避免把 A 帳號留在本機的資料直接合併上傳到 B 帳號的 Drive。
 * 只存 Google 帳號 ID（userinfo 的 sub）的 SHA-256 雜湊值，不存姓名或 Email；
 * 跟主資料放在同一個命名空間（不會同步到 Drive），登出時保留，「刪除所有資料」時一起清掉。
 */
const state = kv('state')
const KEY = 'acacia-sync-account'

/** 把 Google 帳號 ID 轉成雜湊值（十六進位字串） */
export async function accountKey(sub: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`acacia:${sub}`))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** 上次成功同步的帳號雜湊值；從沒同步過時為 null */
export async function loadBoundAccount(): Promise<string | null> {
  return (await state.get<string>(KEY)) ?? null
}

export const saveBoundAccount = (key: string) => state.set(KEY, key)
