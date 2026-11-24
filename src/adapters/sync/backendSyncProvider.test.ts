import { describe, expect, it } from 'vitest'
import { emptySharedCalendarData, type SharedCalendarData } from '../../core/sharing'
import { buildSpaceSyncPayload } from '../../core/syncEnvelope'
import { familySpace, makeItem, SECRET, T0, U, workSpace } from '../../test/sharingFixtures'
import { createBackendSyncProvider, pushRequestBodySchema, sanitizeIncomingPayload } from './backendSyncProvider'

type Call = { url: string; init: RequestInit }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function setup(responses: (Response | Error)[], opts: { token?: string | null; online?: boolean } = {}) {
  const calls: Call[] = []
  const queue = [...responses]
  const provider = createBackendSyncProvider({
    baseUrl: 'https://api.example.test/',
    getToken: () => (opts.token === undefined ? 'tok' : opts.token),
    deviceId: 'dev-1',
    now: () => T0 + 999,
    isOnline: () => opts.online ?? true,
    fetch: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} })
      const next = queue.shift()
      if (!next) throw new Error('沒有預期的請求')
      if (next instanceof Error) throw next
      return next
    },
  })
  return { provider, calls }
}

function kidData(): SharedCalendarData {
  const family = familySpace()
  return {
    ...emptySharedCalendarData(U.kid),
    spaces: [family],
    items: [
      makeItem({ id: 'kid-own', spaceId: family.id, createdBy: U.kid, kind: 'exam', title: '期末考', updatedAt: T0 + 5 }),
      makeItem({ id: 'mom-public', spaceId: family.id, createdBy: U.mom, updatedAt: T0 + 6 }),
      { ...makeItem({ id: 'dad-busy', spaceId: family.id, createdBy: U.dad, title: '', updatedAt: T0 + 7 }), redaction: 'busy' },
    ],
  }
}

describe('後端同步：增量拉取', () => {
  it('帶 token、裝置 id 與 since 游標，hasMore 時繼續翻頁', async () => {
    const family = familySpace()
    const data = { ...emptySharedCalendarData(U.mom), spaces: [family], items: [makeItem({ id: 'a', spaceId: family.id, createdBy: U.mom, updatedAt: T0 + 1 })] }
    const page = buildSpaceSyncPayload({ data, spaceId: family.id, viewerId: U.kid, now: T0 })!
    const { provider, calls } = setup([
      json({ cursor: 'c1', hasMore: true, payloads: [page] }),
      json({ cursor: 'c2', hasMore: false, payloads: [], busyProjectionRules: [] }),
    ])

    const r = await provider.pull({ viewerId: U.kid, since: 'c0' })
    expect(calls.map((c) => c.url)).toEqual(['https://api.example.test/v1/sync/changes?since=c0', 'https://api.example.test/v1/sync/changes?since=c1'])
    expect(calls[0].init.headers).toMatchObject({ Authorization: 'Bearer tok', 'X-Acacia-Device': 'dev-1' })
    expect(r.cursor).toBe('c2')
    expect(r.payloads[0].entries.map((e) => e.id)).toEqual(['a'])
    expect(provider.getStatus()).toMatchObject({ state: 'idle', cursor: 'c2', lastSyncedAt: T0 + 999 })
  })

  it('第二道防線：丟掉不是自己的封包、非成員空間與 spaceId 不符的變更、別人的投射規則', async () => {
    const family = familySpace()
    const work = workSpace()
    const famData = { ...emptySharedCalendarData(U.mom), spaces: [family], items: [makeItem({ id: 'ok', spaceId: family.id, createdBy: U.mom })] }
    const forKid = buildSpaceSyncPayload({ data: famData, spaceId: family.id, viewerId: U.kid, now: T0 })!
    const smuggled = { ...forKid, entries: [...forKid.entries, makeItem({ id: 'smuggled', spaceId: work.id, createdBy: U.dad, title: SECRET.title })] }
    const forDad = buildSpaceSyncPayload({ data: famData, spaceId: family.id, viewerId: U.dad, now: T0 })!
    const workData = { ...emptySharedCalendarData(U.dad), spaces: [work], items: [] }
    const workPayload = { ...buildSpaceSyncPayload({ data: workData, spaceId: work.id, viewerId: U.dad, now: T0 })!, viewerId: U.kid }

    const { provider } = setup([
      json({
        cursor: 'c',
        payloads: [smuggled, forDad, workPayload],
        busyProjectionRules: [
          { id: 'mine', userId: U.kid, sourceSpaceId: 'a', targetSpaceId: 'b' },
          { id: 'theirs', userId: U.dad, sourceSpaceId: 'a', targetSpaceId: 'b' },
        ],
      }),
    ])
    const r = await provider.pull({ viewerId: U.kid, since: null })
    expect(r.payloads).toHaveLength(1)
    expect(r.payloads[0].entries.map((e) => e.id)).toEqual(['ok'])
    expect(JSON.stringify(r)).not.toContain(SECRET.title)
    expect(r.rules.map((x) => x.id)).toEqual(['mine'])

    expect(sanitizeIncomingPayload({ ...forKid, space: { ...forKid.space, deletedAt: T0 } }, U.kid)).toBeNull()
  })

  it('回應格式錯誤：invalid_payload', async () => {
    const { provider } = setup([json({ nope: true })])
    await expect(provider.pull({ viewerId: U.kid, since: null })).rejects.toMatchObject({ code: 'invalid_payload' })
    expect(provider.getStatus().state).toBe('error')
  })
})

describe('後端同步：推送', () => {
  it('只送自己能推送的變更（不含遮罩副本），不帶 viewerId，由伺服器依 token 判斷身分', async () => {
    const { provider, calls } = setup([json({ accepted: ['kid-own'], rejected: [], conflicts: [], cursor: 'c9' })])
    const r = await provider.push({ viewerId: U.kid, data: kidData(), changedSince: null })

    const body = pushRequestBodySchema.parse(JSON.parse(String(calls[0].init.body)))
    expect(calls[0].init.method).toBe('POST')
    expect(calls[0].init.headers).toMatchObject({ 'Content-Type': 'application/json' })
    // 小孩是 viewer：只能推送自己建立的
    expect(body.changes.map((c) => c.id)).toEqual(['kid-own'])
    expect(JSON.parse(String(calls[0].init.body))).not.toHaveProperty('viewerId')
    expect(r).toEqual({ accepted: ['kid-own'], rejected: [], conflicts: [], cursor: 'c9' })
  })

  it('changedSince 之前的變更不重送', async () => {
    const { provider, calls } = setup([json({ accepted: [], cursor: null })])
    await provider.push({ viewerId: U.kid, data: kidData(), changedSince: T0 + 5 })
    expect(JSON.parse(String(calls[0].init.body)).changes).toEqual([])
  })

  it('伺服器回報衝突與拒絕（例如權限不足）：狀態 conflict，結果原樣回傳', async () => {
    const conflict = { id: 'kid-own', spaceId: 'sp-family', localVersion: 2, incomingVersion: 2, localUpdatedAt: 1, incomingUpdatedAt: 2, winner: 'incoming' }
    const { provider } = setup([json({ accepted: [], rejected: [{ id: 'x', reason: 'forbidden' }], conflicts: [conflict], cursor: 'c' })])
    const r = await provider.push({ viewerId: U.kid, data: kidData(), changedSince: null })
    expect(r.rejected).toEqual([{ id: 'x', reason: 'forbidden' }])
    expect(provider.getStatus()).toMatchObject({ state: 'conflict', conflicts: [conflict] })
  })

  it('只能推送自己的資料', async () => {
    const { provider, calls } = setup([])
    await expect(provider.push({ viewerId: U.mom, data: kidData(), changedSince: null })).rejects.toMatchObject({ code: 'forbidden' })
    expect(calls).toEqual([])
  })
})

describe('後端同步：錯誤回報', () => {
  it.each([
    [401, 'auth', 'error'],
    [403, 'forbidden', 'error'],
    [409, 'conflict', 'conflict'],
    [503, 'server', 'error'],
  ] as const)('HTTP %i → %s（狀態 %s）', async (status, code, state) => {
    const { provider } = setup([json({}, status)])
    await expect(provider.pull({ viewerId: U.kid, since: null })).rejects.toMatchObject({ code, status })
    expect(provider.getStatus().state).toBe(state)
  })

  it('網路中斷 → offline；瀏覽器離線時不發出請求；沒登入 → auth', async () => {
    const a = setup([new TypeError('Failed to fetch')])
    await expect(a.provider.pull({ viewerId: U.kid, since: null })).rejects.toMatchObject({ code: 'network', retryable: true })
    expect(a.provider.getStatus().state).toBe('offline')

    const b = setup([], { online: false })
    await expect(b.provider.push({ viewerId: U.kid, data: kidData(), changedSince: null })).rejects.toMatchObject({ code: 'network' })
    expect(b.calls).toEqual([])

    const c = setup([], { token: null })
    await expect(c.provider.pull({ viewerId: U.kid, since: null })).rejects.toMatchObject({ code: 'auth' })
  })

  it('disconnect 重設狀態', async () => {
    const { provider } = setup([json({ accepted: [], cursor: 'c' })])
    await provider.push({ viewerId: U.kid, data: kidData(), changedSince: null })
    await provider.disconnect()
    expect(provider.getStatus()).toMatchObject({ state: 'idle', cursor: null, lastSyncedAt: null })
  })
})
