import { describe, expect, it } from 'vitest'
import { familySpace, makeItem, SECRET, T0, U, workSpace } from '../test/sharingFixtures'
import { projectedBlockId } from './permissions'
import { busyProjectionRuleSchema, emptySharedCalendarData, type SharedCalendarData, type SharedCalendarItem } from './sharing'
import {
  buildSpaceSyncPayload,
  buildViewerExport,
  containsLocalOnlyData,
  mergeSyncEntries,
  parseSpaceSyncPayload,
  pickWinner,
  purgeTombstones,
  selectPushableChanges,
  SPACE_SYNC_FORMAT,
  SyncPayloadError,
  toTombstone,
} from './syncEnvelope'

const SECRET_RE = new RegExp(Object.values(SECRET).join('|'))

/** 爸爸的資料：家人空間 + 工作空間，有各種可見性的行程與一條工作→家人忙閒投射規則 */
function dadData(): { data: SharedCalendarData; ids: Record<string, string> } {
  const family = familySpace()
  const work = workSpace()
  const secret = { title: SECRET.title, location: SECRET.location, note: SECRET.note, details: { doctor: SECRET.detail } }
  const items = {
    dinner: makeItem({ spaceId: family.id, createdBy: U.mom, title: '家庭聚餐', updatedAt: T0 + 1 }),
    surprise: makeItem({ spaceId: family.id, createdBy: U.mom, ...secret, visibility: { mode: 'selected_members', allowedUserIds: [U.kid] }, updatedAt: T0 + 2 }),
    clinic: makeItem({ spaceId: family.id, createdBy: U.dad, kind: 'medical_ride', ...secret, visibility: { mode: 'busy_only', busyLabel: '接送' }, updatedAt: T0 + 3 }),
    masked: makeItem({ spaceId: family.id, createdBy: U.dad, kind: 'homecoming', ...secret, visibility: { mode: 'group_full', maskedFields: ['title', 'location', 'note', 'details'] }, updatedAt: T0 + 4 }),
    hiddenFromKid: makeItem({ spaceId: family.id, createdBy: U.dad, ...secret, visibility: { mode: 'group_full', hiddenUserIds: [U.kid] }, updatedAt: T0 + 5 }),
    dadPrivate: makeItem({ spaceId: family.id, createdBy: U.dad, ...secret, visibility: { mode: 'private' }, updatedAt: T0 + 6 }),
    meeting: makeItem({ spaceId: work.id, createdBy: U.dad, kind: 'meeting', ...secret, start: '14:00', end: '15:00', updatedAt: T0 + 7 }),
    deleted: makeItem({ spaceId: family.id, createdBy: U.mom, ...secret, deletedAt: T0 + 8, updatedAt: T0 + 8 }),
  }
  const rule = busyProjectionRuleSchema.parse({ id: 'r-work', userId: U.dad, sourceSpaceId: work.id, targetSpaceId: family.id, label: '上班中' })
  const data: SharedCalendarData = { ...emptySharedCalendarData(U.dad), spaces: [family, work], items: Object.values(items), busyProjectionRules: [rule], updatedAt: T0 + 8 }
  return { data, ids: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v.id])) }
}

const entry = (p: ReturnType<typeof buildSpaceSyncPayload>, id: string) => p?.entries.find((e) => e.id === id)

describe('同步封包建構', () => {
  it('封包格式正確，通過 schema 驗證，游標為最後一筆變更時間', () => {
    const { data } = dadData()
    const p = buildSpaceSyncPayload({ data, spaceId: 'sp-family', viewerId: U.dad, now: T0 + 100 })!
    expect(p).toMatchObject({ format: SPACE_SYNC_FORMAT, payloadVersion: 1, spaceId: 'sp-family', viewerId: U.dad, since: null, generatedAt: T0 + 100 })
    expect(parseSpaceSyncPayload(JSON.parse(JSON.stringify(p)))).toEqual(JSON.parse(JSON.stringify(p)))
    expect(p.cursor).toBe(String(T0 + 8))
    // 依更新時間排序
    expect(p.entries.map((e) => e.updatedAt)).toEqual([...p.entries.map((e) => e.updatedAt)].sort((a, b) => a - b))
  })

  it('增量：只輸出 since 之後的變更', () => {
    const { data, ids } = dadData()
    const p = buildSpaceSyncPayload({ data, spaceId: 'sp-family', viewerId: U.dad, now: T0, since: T0 + 5 })!
    expect(p.entries.map((e) => e.id)).toEqual([ids.dadPrivate, projectedBlockId('r-work', ids.meeting), ids.deleted])
    const empty = buildSpaceSyncPayload({ data, spaceId: 'sp-family', viewerId: U.dad, now: T0, since: T0 + 999 })!
    expect(empty.entries).toEqual([])
    expect(empty.cursor).toBe(String(T0 + 999))
  })

  it('非成員拿不到封包；只匯出檢視者所屬的空間', () => {
    const { data } = dadData()
    expect(buildSpaceSyncPayload({ data, spaceId: 'sp-family', viewerId: U.stranger, now: T0 })).toBeNull()
    expect(buildSpaceSyncPayload({ data, spaceId: 'sp-work', viewerId: U.kid, now: T0 })).toBeNull()
    expect(buildSpaceSyncPayload({ data, spaceId: 'sp-nope', viewerId: U.dad, now: T0 })).toBeNull()
    expect(buildViewerExport(data, U.kid, T0).map((p) => p.spaceId)).toEqual(['sp-family'])
    expect(buildViewerExport(data, U.coworker, T0).map((p) => p.spaceId)).toEqual(['sp-work'])
    expect(buildViewerExport(data, U.dad, T0).map((p) => p.spaceId)).toEqual(['sp-family', 'sp-work'])
  })

  it('建立者自己的封包保留完整內容（Drive 自己的檔案）', () => {
    const { data, ids } = dadData()
    const p = buildSpaceSyncPayload({ data, spaceId: 'sp-family', viewerId: U.dad, now: T0 })!
    expect(entry(p, ids.dadPrivate)?.title).toBe(SECRET.title)
    expect(entry(p, ids.clinic)?.visibility.busyLabel).toBe('接送')
    expect(entry(p, ids.surprise)).toBeUndefined() // 媽媽沒把驚喜分享給爸爸
  })

  it('不會把本機專屬設定（acacia-consent）帶進封包，外來的未知欄位也會被捨棄', () => {
    const { data } = dadData()
    const polluted = { ...data, 'acacia-consent': { privacy: '2026-01-01', acceptedAt: 1 } } as SharedCalendarData
    const payloads = buildViewerExport(polluted, U.dad, T0)
    expect(containsLocalOnlyData(payloads)).toBe(false)

    const raw = { ...JSON.parse(JSON.stringify(payloads[0])), 'acacia-consent': { acceptedAt: 1 } }
    expect(containsLocalOnlyData(raw)).toBe(true)
    expect(containsLocalOnlyData(parseSpaceSyncPayload(raw))).toBe(false)
  })

  it('格式錯誤的封包丟出 SyncPayloadError', () => {
    expect(() => parseSpaceSyncPayload({ format: 'other' })).toThrow(SyncPayloadError)
  })
})

describe('同步輸出給特定檢視者：敏感欄位與未授權行程', () => {
  it('小孩（viewer）：看不到私人、被隱藏的行程；忙閒與遮罩行程不帶敏感字串', () => {
    const { data, ids } = dadData()
    const p = buildSpaceSyncPayload({ data, spaceId: 'sp-family', viewerId: U.kid, now: T0 })!
    const got = new Set(p.entries.map((e) => e.id))
    expect(got.has(ids.dadPrivate)).toBe(false)
    expect(got.has(ids.hiddenFromKid)).toBe(false)
    expect(got.has(ids.surprise)).toBe(true) // 白名單內

    expect(entry(p, ids.clinic)).toMatchObject({ redaction: 'busy', title: '', kind: 'event', visibility: { busyLabel: '接送' } })
    expect(entry(p, ids.masked)).toMatchObject({ redaction: 'masked', title: '', location: '', kind: 'homecoming' })
    expect(entry(p, projectedBlockId('r-work', ids.meeting))).toMatchObject({ redaction: 'busy', start: '14:00', end: '15:00', visibility: { busyLabel: '上班中' } })

    // 除了白名單內的驚喜行程，其他輸出都不能出現敏感字串
    const others = p.entries.filter((e) => e.id !== ids.surprise)
    expect(JSON.stringify(others)).not.toMatch(SECRET_RE)
    // 也不能透露有人被隱藏、工作空間 id 或投射規則
    expect(JSON.stringify(p.entries)).not.toMatch(/u-grandma|sp-work|r-work/)
  })

  it('奶奶（不在白名單）：連驚喜行程都看不到，整份封包沒有任何敏感字串', () => {
    const { data, ids } = dadData()
    const p = buildSpaceSyncPayload({ data, spaceId: 'sp-family', viewerId: U.grandma, now: T0 })!
    expect(entry(p, ids.surprise)).toBeUndefined()
    expect(entry(p, ids.hiddenFromKid)).toBeDefined()
    // hiddenFromKid 對奶奶是完整可見的，排除它之後檢查
    expect(JSON.stringify(p.entries.filter((e) => e.id !== ids.hiddenFromKid))).not.toMatch(SECRET_RE)
  })

  it('同事：工作封包裡看得到會議，但不會收到家人空間任何東西', () => {
    const { data, ids } = dadData()
    const payloads = buildViewerExport(data, U.coworker, T0)
    expect(payloads).toHaveLength(1)
    expect(payloads[0].entries.map((e) => e.id)).toEqual([ids.meeting])
    expect(JSON.stringify(payloads)).not.toMatch(/家庭聚餐|接送|上班中/)
  })

  it('已刪除的行程輸出為不含內容的墓碑', () => {
    const { data, ids } = dadData()
    const p = buildSpaceSyncPayload({ data, spaceId: 'sp-family', viewerId: U.kid, now: T0 })!
    const tomb = entry(p, ids.deleted)!
    expect(tomb).toMatchObject({ deletedAt: T0 + 8, title: '', location: '', note: '', details: {} })
    expect(JSON.stringify(tomb)).not.toMatch(SECRET_RE)
  })

  it('權限被收回：對方手上的舊副本會收到不含內容的收回墓碑；從沒看過的不會收到', () => {
    const { data, ids } = dadData()
    const revoked = data.items.map((i) => (i.id === ids.dinner ? { ...i, visibility: { ...i.visibility, hiddenUserIds: [U.kid] }, version: 2, updatedAt: T0 + 50 } : i))
    const next = { ...data, items: revoked }

    const withHistory = buildSpaceSyncPayload({ data: next, spaceId: 'sp-family', viewerId: U.kid, now: T0, since: T0 + 10, previouslyVisibleIds: [ids.dinner] })!
    expect(withHistory.entries).toHaveLength(1)
    expect(withHistory.entries[0]).toMatchObject({ id: ids.dinner, deletedAt: T0 + 50, title: '', dateISO: '1970-01-01', redaction: 'busy' })

    const withoutHistory = buildSpaceSyncPayload({ data: next, spaceId: 'sp-family', viewerId: U.kid, now: T0, since: T0 + 10 })!
    expect(withoutHistory.entries).toEqual([])
    // 看不到的變更不會推進游標（不透露變更時間）
    expect(withoutHistory.cursor).toBe(String(T0 + 10))
  })
})

describe('合併：軟刪除與時間戳記衝突', () => {
  const base = () => makeItem({ id: 'x', spaceId: 'sp-family', createdBy: U.mom, title: '原本', version: 3, updatedAt: T0 + 10, updatedBy: U.mom })

  it('版本較大者勝，不算衝突', () => {
    const local = base()
    const incoming = { ...local, title: '新版', version: 4, updatedAt: T0 + 5 }
    expect(pickWinner(local, incoming)).toEqual({ winner: 'incoming', conflict: false })
    const r = mergeSyncEntries([local], [incoming], { viewerId: U.dad })
    expect(r.items[0].title).toBe('新版')
    expect(r).toMatchObject({ applied: 1, conflicts: [] })
    expect(mergeSyncEntries([incoming], [local], { viewerId: U.dad }).items[0].title).toBe('新版')
  })

  it('同版本但兩邊都改了：回報衝突，updatedAt 較新者勝', () => {
    const local = { ...base(), title: '本機改', version: 4, updatedAt: T0 + 20 }
    const incoming = { ...base(), title: '雲端改', version: 4, updatedAt: T0 + 30, updatedBy: U.dad }
    const r = mergeSyncEntries([local], [incoming], { viewerId: U.mom })
    expect(r.items[0].title).toBe('雲端改')
    expect(r.conflicts).toEqual([{ id: 'x', spaceId: 'sp-family', localVersion: 4, incomingVersion: 4, localUpdatedAt: T0 + 20, incomingUpdatedAt: T0 + 30, winner: 'incoming' }])

    const reverse = mergeSyncEntries([incoming], [local], { viewerId: U.mom })
    expect(reverse.items[0].title).toBe('雲端改')
    expect(reverse.conflicts[0].winner).toBe('local')
  })

  it('同版本同時間：刪除優先，避免已刪除的行程復活', () => {
    const local = { ...base(), version: 4, updatedAt: T0 + 20 }
    const tomb = { ...toTombstone({ ...base(), deletedAt: T0 + 20 }), version: 4, updatedAt: T0 + 20 }
    expect(pickWinner(local, tomb)).toEqual({ winner: 'incoming', conflict: true })
    expect(pickWinner(tomb, local)).toEqual({ winner: 'local', conflict: true })
  })

  it('完全相同的時間與狀態，以 updatedBy 決定，兩邊結果一致', () => {
    const a = { ...base(), title: 'A', version: 4, updatedAt: T0 + 20, updatedBy: 'u-a' }
    const b = { ...base(), title: 'B', version: 4, updatedAt: T0 + 20, updatedBy: 'u-b' }
    expect(mergeSyncEntries([a], [b], { viewerId: U.kid }).items[0].title).toBe('B')
    expect(mergeSyncEntries([b], [a], { viewerId: U.kid }).items[0].title).toBe('B')
  })

  it('軟刪除：較新版本的墓碑取代本機資料並保留下來，舊版本不會讓它復活', () => {
    const local = base()
    const tomb = toTombstone({ ...local, version: 4, updatedAt: T0 + 40, deletedAt: T0 + 40 })
    const merged = mergeSyncEntries([local], [tomb], { viewerId: U.dad }).items
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ deletedAt: T0 + 40, title: '' })

    const stale = mergeSyncEntries(merged, [local], { viewerId: U.dad })
    expect(stale.items[0].deletedAt).toBe(T0 + 40)
    expect(stale.applied).toBe(0)
  })

  it('新的行程直接加入；已同步過的相同版本不重複套用', () => {
    const local = base()
    const fresh = makeItem({ id: 'y', spaceId: 'sp-family', createdBy: U.dad })
    const r = mergeSyncEntries([local], [local, fresh], { viewerId: U.mom })
    expect(r.items.map((i) => i.id)).toEqual(['x', 'y'])
    expect(r.applied).toBe(1)
  })

  it('自己的完整資料不會被遮罩副本蓋掉；別人的編輯不能改自己行程的可見性', () => {
    const own = { ...base(), visibility: { ...base().visibility, mode: 'selected_members' as const, allowedUserIds: [U.kid] } }
    const redacted: SharedCalendarItem = { ...own, title: '', version: 9, redaction: 'busy' }
    expect(mergeSyncEntries([own], [redacted], { viewerId: U.mom }).items[0].title).toBe('原本')

    const dadEdit = { ...own, title: '爸爸改的', version: 4, updatedAt: T0 + 50, updatedBy: U.dad, visibility: { ...own.visibility, mode: 'group_full' as const, allowedUserIds: [] } }
    const merged = mergeSyncEntries([own], [dadEdit], { viewerId: U.mom }).items[0]
    expect(merged.title).toBe('爸爸改的')
    expect(merged.visibility).toEqual(own.visibility)
  })

  it('purgeTombstones 只清掉超過期限的墓碑', () => {
    const live = base()
    const oldTomb = { ...makeItem({ id: 'o', spaceId: 's', createdBy: U.mom }), deletedAt: T0 }
    const newTomb = { ...makeItem({ id: 'n', spaceId: 's', createdBy: U.mom }), deletedAt: T0 + 100 }
    expect(purgeTombstones([live, oldTomb, newTomb], T0 + 50).map((i) => i.id)).toEqual(['x', 'n'])
  })
})

describe('可推送的變更', () => {
  it('只推送自己建立或有編輯權的行程；不推送遮罩副本與投射區塊', () => {
    const { data, ids } = dadData()
    const redactedCopy: SharedCalendarItem = { ...makeItem({ spaceId: 'sp-family', createdBy: U.mom }), redaction: 'busy' }
    const projected = { ...makeItem({ spaceId: 'sp-family', createdBy: U.dad }), projection: { ruleId: 'r-work' } }
    const withExtras = { ...data, items: [...data.items, redactedCopy, projected] }

    const pushable = selectPushableChanges(withExtras, U.dad).map((i) => i.id)
    // 爸爸是家人空間 editor：媽媽公開的聚餐與已刪除的墓碑有編輯權，可以推送；看不到的驚喜不行
    expect(pushable).toEqual(expect.arrayContaining([ids.dinner, ids.clinic, ids.masked, ids.hiddenFromKid, ids.dadPrivate, ids.meeting, ids.deleted]))
    expect(pushable).not.toContain(ids.surprise)
    expect(pushable).not.toContain(redactedCopy.id)
    expect(pushable).not.toContain(projected.id)

    // 小孩是 viewer：只能推送自己建立的
    expect(selectPushableChanges(withExtras, U.kid)).toEqual([])
    expect(selectPushableChanges(withExtras, U.dad, T0 + 6).map((i) => i.id)).toEqual([ids.meeting, ids.deleted])
  })
})
