import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { kv } from '../adapters/kv'
import { loadIndex } from '../adapters/backupStorage'
import { migrate } from '../core/migrate'
import { emptyAppData, SCHEMA_VERSION } from '../core/schema'

vi.mock('../adapters/googleAuth', () => ({
  restoreToken: () => null,
  signIn: async () => ({ token: 'tok', expiresAt: Date.now() + 3600_000 }),
  signOut: async () => {},
  fetchProfile: async () => ({ name: 'QQ' }),
}))

const { useAppStore } = await import('./useAppStore')
const { useBackupStore } = await import('./useBackupStore')
const { LEGACY_SPACES_COPY_KEY, LEGACY_SPACES_KEY, legacySharedToEvents, migrateLegacySpaces } = await import('./legacySpacesMigration')

const ME = 'local-me'
const item = (patch: Record<string, unknown>) => ({
  id: 'i1',
  spaceId: 'fam',
  kind: 'event',
  title: '家庭聚餐',
  dateISO: '2026-12-20',
  endDateISO: '',
  start: '18:00',
  end: '20:00',
  location: '外婆家',
  note: '帶水果',
  details: {},
  titleColor: '#8a3b2e',
  bgColor: '#fbe9e4',
  icon: 'meal',
  visibility: { mode: 'group_full' },
  createdBy: ME,
  createdAt: 1,
  version: 1,
  updatedAt: 1,
  deletedAt: null,
  ...patch,
})
/** 舊版 zustand persist 存在 acacia-spaces 的內容（JSON 字串） */
const legacyRaw = (items: unknown[], spaces: unknown[] = [{ id: 'fam', name: '陳家', deletedAt: null }, { id: 'gone', name: '已刪除', deletedAt: 5 }]) =>
  JSON.stringify({ state: { selfId: ME, data: { schemaVersion: 2, ownerId: ME, spaces, items, busyProjectionRules: [], personalBusySlots: [] }, cloudSync: true }, version: 0 })

describe('舊共享行程 → 個人行程（純函式）', () => {
  it('只轉自己建立、未刪除、空間還在的原生行程；地點與細節併進備註，跨日保留結束日', () => {
    const events = legacySharedToEvents(
      legacyRaw([
        item({}),
        item({ id: 'trip', title: '家庭旅遊', endDateISO: '2026-12-22', start: '', end: '', location: '', note: '', details: { teacher: '王老師' } }),
        item({ id: 'others', createdBy: 'mom' }),
        item({ id: 'deleted', deletedAt: 9 }),
        item({ id: 'busy', redaction: 'busy' }),
        item({ id: 'proj', projection: { ruleId: 'r' } }),
        item({ id: 'orphan', spaceId: 'gone' }),
      ]),
      new Set(),
    )
    expect(events).toEqual([
      { id: 'i1', title: '家庭聚餐', dateISO: '2026-12-20', start: '18:00', end: '20:00', note: '帶水果 · 外婆家', titleColor: '#8a3b2e', bgColor: '#fbe9e4', icon: 'meal' },
      expect.objectContaining({ id: 'trip', title: '家庭旅遊', endDateISO: '2026-12-22', start: '', end: '', note: '王老師' }),
    ])
  })

  it('id 已經存在：視為轉換過、直接略過（冪等）；同一份資料裡重複的 id 只轉一次', () => {
    expect(legacySharedToEvents(legacyRaw([item({})]), new Set(['i1']))).toEqual([])
    expect(legacySharedToEvents(legacyRaw([item({}), item({ title: '重複' })]), new Set()).map((e) => e.title)).toEqual(['家庭聚餐'])
  })

  it('不認得的圖示改成自動判斷，其他內容照常轉換', () => {
    const [e] = legacySharedToEvents(legacyRaw([item({ icon: 'unknown-icon' })]), new Set())
    expect(e!.icon).toBeUndefined()
    expect(e!.title).toBe('家庭聚餐')
  })

  it('格式壞掉或看不懂：回傳空陣列，不丟錯', () => {
    expect(legacySharedToEvents('{not json', new Set())).toEqual([])
    expect(legacySharedToEvents({ state: null }, new Set())).toEqual([])
    expect(legacySharedToEvents(JSON.stringify({ state: { selfId: ME, data: { items: 'x', spaces: null } } }), new Set())).toEqual([])
  })
})

describe('第一次開啟新版：轉換並清掉本機共享資料', () => {
  beforeEach(async () => {
    useAppStore.setState({ ...emptyAppData(), syncMeta: undefined, updatedAt: 1, events: [{ id: 'p1', title: '牙醫', dateISO: '2026-12-01', start: '14:00', end: '15:00', note: '' }] })
    await kv('state').del(LEGACY_SPACES_KEY)
    await kv('backups').clear()
    useBackupStore.getState().reset()
  })
  afterEach(() => vi.restoreAllMocks())

  it('加進個人行程、轉換前留本機快照與舊資料備份，清掉 acacia-spaces 與共享空間快照；再開一次不會重複', async () => {
    await kv('state').set(LEGACY_SPACES_KEY, legacyRaw([item({})]))
    await kv('spacesBackups').set('index', { snapshots: [] })

    expect(await migrateLegacySpaces()).toBe(1)
    expect(useAppStore.getState().events.map((e) => e.title)).toEqual(['牙醫', '家庭聚餐'])
    expect((await loadIndex()).snapshots.map((s) => s.reason)).toEqual(['beforeMigration'])
    expect(await kv('backups').get(LEGACY_SPACES_COPY_KEY)).toBe(legacyRaw([item({})]))
    expect(await kv('state').get(LEGACY_SPACES_KEY)).toBeUndefined()
    expect(await kv('spacesBackups').keys()).toEqual([])

    expect(await migrateLegacySpaces()).toBe(0)
    expect(useAppStore.getState().events).toHaveLength(2)
  })

  it('另一台裝置已經轉換並同步過來（含已移到最近刪除的）：不重複加入、不救回，舊資料照樣清掉', async () => {
    useAppStore.setState({ events: [...useAppStore.getState().events, { id: 'i1', title: '家庭聚餐', dateISO: '2026-12-20', start: '18:00', end: '20:00', note: '帶水果 · 外婆家', deletedAt: 123 }] })
    await kv('state').set(LEGACY_SPACES_KEY, legacyRaw([item({})]))
    expect(await migrateLegacySpaces()).toBe(0)
    expect(useAppStore.getState().events.filter((e) => e.id === 'i1')).toEqual([expect.objectContaining({ deletedAt: 123 })])
    expect(await kv('state').get(LEGACY_SPACES_KEY)).toBeUndefined()
  })

  it('已經永久刪除（只剩同步刪除標記）的行程：不會被救回來', async () => {
    useAppStore.setState({ syncMeta: { base: 1, t: {}, del: { 'events:i1': 99 } } })
    await kv('state').set(LEGACY_SPACES_KEY, legacyRaw([item({}), item({ id: 'i2', title: '新的' })]))
    expect(await migrateLegacySpaces()).toBe(1)
    expect(useAppStore.getState().events.map((e) => e.id)).toEqual(['p1', 'i2'])
  })

  it('上次轉換到一半中斷（行程已加入、舊資料沒清掉）：下次重跑不會重複', async () => {
    await kv('state').set(LEGACY_SPACES_KEY, legacyRaw([item({})]))
    expect(await migrateLegacySpaces()).toBe(1)
    // 模擬清除那一步沒成功：舊資料還在
    await kv('state').set(LEGACY_SPACES_KEY, legacyRaw([item({})]))
    expect(await migrateLegacySpaces()).toBe(0)
    expect(useAppStore.getState().events.map((e) => e.title)).toEqual(['牙醫', '家庭聚餐'])
    expect(await kv('state').get(LEGACY_SPACES_KEY)).toBeUndefined()
  })

  it('沒有舊的共享資料：什麼都不做', async () => {
    expect(await migrateLegacySpaces()).toBe(0)
    expect((await loadIndex()).snapshots).toEqual([])
  })

  it('轉換途中出錯：跳過、不清掉舊資料、個人資料不變（下次開啟再試）', async () => {
    await kv('state').set(LEGACY_SPACES_KEY, legacyRaw([item({})]))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(useAppStore.getState(), 'restoreEvents').mockImplementation(() => {
      throw new Error('boom')
    })
    expect(await migrateLegacySpaces()).toBe(0)
    expect(await kv('state').get(LEGACY_SPACES_KEY)).toBeDefined()
    expect(useAppStore.getState().events.map((e) => e.id)).toEqual(['p1'])
  })
})

describe('既有同步檔帶著舊的共享欄位', () => {
  it('主資料的同步檔多出看不懂的欄位：照常讀取，個人資料完整，多的欄位被丟掉', () => {
    const cloud = {
      ...emptyAppData(),
      schemaVersion: SCHEMA_VERSION,
      updatedAt: 5,
      events: [{ id: 'p1', title: '牙醫', dateISO: '2026-12-01', start: '14:00', end: '15:00', note: '', visibility: { mode: 'busy_only' }, spaceId: 'fam' }],
      tasks: [{ id: 't1', title: '繳電費', loc: '', date: '', time: '', done: false }],
      spaces: [{ id: 'fam' }],
      busyProjectionRules: [{ id: 'r1' }],
      personalBusySlots: [{ id: 'p1' }],
    }
    const data = migrate(cloud)
    expect(data.events).toEqual([{ id: 'p1', title: '牙醫', dateISO: '2026-12-01', start: '14:00', end: '15:00', note: '' }])
    expect(data.tasks.map((x) => x.title)).toEqual(['繳電費'])
    expect(data).not.toHaveProperty('spaces')
    expect(data).not.toHaveProperty('busyProjectionRules')
  })
})
