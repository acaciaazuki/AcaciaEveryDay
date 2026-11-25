import 'fake-indexeddb/auto'
import { expect, it, vi } from 'vitest'
import { emptyAppData } from '../core/schema'
import { TRASH_RETENTION_MS } from '../core/trash'

vi.mock('../adapters/googleAuth', () => ({
  restoreToken: () => null,
  signIn: async () => ({ token: 'tok', expiresAt: Date.now() + 3600_000 }),
  signOut: async () => {},
  fetchProfile: async () => ({ name: 'QQ' }),
}))
const files: Record<string, string> = {}
vi.mock('../adapters/drive', () => ({
  DRIVE_FILE: 'acacia_data_v2.json',
  LEGACY_DRIVE_FILE: 'acacia_data.json',
  SPACES_DRIVE_FILE: 'acacia_spaces_v1.json',
  findFile: async (_t: string, name: string) => (name in files ? name : null),
  download: async (_t: string, id: string) => JSON.parse(files[id]!),
  upload: async (_t: string, _id: string | null, name: string, data: unknown) => {
    files[name] = JSON.stringify(data)
    return name
  },
}))
const { useAppStore } = await import('./useAppStore')
const { useSyncStore } = await import('./useSyncStore')

it('雲端同步合併後清掉最近刪除滿 30 天的行程，清理結果寫回雲端', async () => {
  const old = Date.now() - TRASH_RETENTION_MS - 1000
  // 另一台裝置刪除的行程，已經在雲端的最近刪除放了超過 30 天
  files['acacia_data_v2.json'] = JSON.stringify({
    ...emptyAppData(),
    updatedAt: old,
    events: [
      { id: 'gone', title: '過期', dateISO: '2026-10-01', start: '', end: '', note: '', deletedAt: old },
      { id: 'keep', title: '保留', dateISO: '2026-10-02', start: '', end: '', note: '' },
    ],
    syncMeta: { base: old, t: {}, del: {} },
  })
  useAppStore.setState({ ...emptyAppData(), updatedAt: 0 })
  await useSyncStore.getState().connect(true)
  expect(useAppStore.getState().events.map((e) => e.id)).toEqual(['keep'])
  const cloud = JSON.parse(files['acacia_data_v2.json']!) as { events: { id: string }[]; syncMeta: { del: Record<string, number> } }
  expect(cloud.events.map((e) => e.id)).toEqual(['keep'])
  // 留下刪除標記：還沒同步的裝置不會把它帶回來
  expect(cloud.syncMeta.del['events:gone']).toEqual(expect.any(Number))
})
