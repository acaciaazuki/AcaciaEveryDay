import type { DriveApi } from '../adapters/sync/driveSyncProvider'

/** 假的 Google Drive：以檔名當 id，記錄每次上傳與刪除；可以模擬錯誤 */
export function fakeDrive(initial: Record<string, unknown> = {}) {
  const files: Record<string, unknown> = { ...initial }
  const uploads: { name: string; data: unknown }[] = []
  const deleted: string[] = []
  let failWith: Error | null = null
  const api: DriveApi = {
    findFile: async (_t, name) => {
      if (failWith) throw failWith
      return name in files ? name : null
    },
    download: async (_t, id) => JSON.parse(JSON.stringify(files[id])),
    upload: async (_t, _id, name, data) => {
      uploads.push({ name, data })
      files[name] = JSON.parse(JSON.stringify(data))
      return name
    },
    deleteFile: async (_t, id) => {
      deleted.push(id)
      delete files[id]
    },
  }
  return { api, files, uploads, deleted, fail: (e: Error | null) => (failWith = e) }
}
