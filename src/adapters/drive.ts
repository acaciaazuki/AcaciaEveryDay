/**
 * Google Drive appData 讀寫。
 * 新版寫入 acacia_data_v2.json，不覆蓋舊版的 acacia_data.json，
 * 這樣舊網站在過渡期仍能照常同步；第一次登入時若沒有 v2 檔，會讀舊檔並轉換。
 */
export const DRIVE_FILE = 'acacia_data_v2.json'
export const LEGACY_DRIVE_FILE = 'acacia_data.json'
/** 自動備份槽：只放最新一份自動備份，跟同步檔分開，不會覆蓋 acacia_data_v2.json */
export const BACKUP_DRIVE_FILE = 'acacia_backup_v2.json'

export class DriveError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

const api = 'https://www.googleapis.com'

async function call(token: string, url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } })
  if (!res.ok) throw new DriveError(`Drive ${res.status}`, res.status)
  return res
}

export async function findFile(token: string, name: string): Promise<string | null> {
  const q = encodeURIComponent(`name = '${name}' and trashed = false`)
  const res = await call(token, `${api}/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)&pageSize=1`)
  const data = (await res.json()) as { files?: { id: string }[] }
  return data.files?.[0]?.id ?? null
}

export async function download(token: string, id: string): Promise<unknown> {
  const res = await call(token, `${api}/drive/v3/files/${id}?alt=media`)
  return res.json()
}

/** 建立或更新檔案，回傳檔案 id */
export async function upload(token: string, id: string | null, name: string, data: unknown): Promise<string> {
  const boundary = `acacia-${crypto.randomUUID()}`
  const meta = id ? { name, mimeType: 'application/json' } : { name, mimeType: 'application/json', parents: ['appDataFolder'] }
  const part = (body: string) => `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${body}\r\n`
  const body = `${part(JSON.stringify(meta))}${part(JSON.stringify(data))}--${boundary}--`
  const url = id ? `${api}/upload/drive/v3/files/${id}?uploadType=multipart` : `${api}/upload/drive/v3/files?uploadType=multipart`
  const res = await call(token, url, { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })
  return ((await res.json()) as { id: string }).id
}

/** 刪除檔案（「刪除所有資料」用）。檔案已不存在時視為成功 */
export async function deleteFile(token: string, id: string): Promise<void> {
  const res = await fetch(`${api}/drive/v3/files/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok && res.status !== 404) throw new DriveError(`Drive ${res.status}`, res.status)
}
