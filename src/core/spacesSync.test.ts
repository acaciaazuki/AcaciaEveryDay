import { describe, expect, it } from 'vitest'
import { familySpace, makeItem, T0, U, workSpace } from '../test/sharingFixtures'
import { busyProjectionRuleSchema, emptySharedCalendarData, rekeyOwner, type SharedCalendarData } from './sharing'
import { prepareSpacesRestore, spacesCountsOf } from './spacesBackup'
import { applyPulled, buildViewerExport, mergeRuleLists } from './syncEnvelope'

const rule = (p: Partial<Parameters<typeof busyProjectionRuleSchema.parse>[0]> = {}) =>
  busyProjectionRuleSchema.parse({ id: 'r', userId: U.dad, sourceSpaceId: 'sp-work', targetSpaceId: 'sp-family', updatedAt: T0, ...p })

function dad(): SharedCalendarData {
  return {
    ...emptySharedCalendarData(U.dad),
    spaces: [familySpace(), workSpace()],
    items: [makeItem({ id: 'a', spaceId: 'sp-work', createdBy: U.dad, title: '週會' }), makeItem({ id: 'b', spaceId: 'sp-family', createdBy: U.mom, title: '聚餐' })],
    busyProjectionRules: [rule()],
    updatedAt: T0,
  }
}

describe('applyPulled', () => {
  it('較新的行程、空間、規則會套用；舊的不會蓋掉本機', () => {
    const local = dad()
    const remote = structuredClone(local)
    remote.items[0] = { ...remote.items[0]!, title: '週會（改時間）', version: 2, updatedAt: T0 + 10 }
    remote.spaces[1] = { ...remote.spaces[1]!, name: '設計部', version: remote.spaces[1]!.version + 1, updatedAt: T0 + 10 }
    remote.busyProjectionRules[0] = { ...remote.busyProjectionRules[0]!, label: '上班中', updatedAt: T0 + 10 }
    const r = applyPulled(local, { payloads: buildViewerExport(remote, U.dad, T0 + 20), rules: remote.busyProjectionRules }, U.dad)
    expect(r.changed).toBe(true)
    expect(r.data.items.find((i) => i.id === 'a')!.title).toBe('週會（改時間）')
    expect(r.data.spaces.find((s) => s.id === 'sp-work')!.name).toBe('設計部')
    expect(r.data.busyProjectionRules[0]!.label).toBe('上班中')

    const back = applyPulled(r.data, { payloads: buildViewerExport(local, U.dad, T0), rules: local.busyProjectionRules }, U.dad)
    expect(back.changed).toBe(false)
    expect(back.data).toBe(r.data)
  })

  it('刪除（行程、空間、規則）都會同步過來', () => {
    const local = dad()
    const remote = structuredClone(local)
    remote.items[0] = { ...remote.items[0]!, deletedAt: T0 + 5, version: 2, updatedAt: T0 + 5 }
    remote.busyProjectionRules[0] = { ...remote.busyProjectionRules[0]!, deletedAt: T0 + 5, updatedAt: T0 + 5 }
    const r = applyPulled(local, { payloads: buildViewerExport(remote, U.dad, T0 + 6), rules: remote.busyProjectionRules }, U.dad)
    expect(r.data.items.find((i) => i.id === 'a')!.deletedAt).toBe(T0 + 5)
    expect(r.data.busyProjectionRules[0]!.deletedAt).toBe(T0 + 5)
  })

  it('不是給自己的封包、別人的規則都略過', () => {
    const local = dad()
    const forMom = buildViewerExport({ ...local, items: [makeItem({ id: 'x', spaceId: 'sp-family', createdBy: U.mom, title: '別人的' })] }, U.mom, T0)
    const r = applyPulled(local, { payloads: forMom, rules: [rule({ id: 'other', userId: U.mom })] }, U.dad)
    expect(r.changed).toBe(false)
  })
})

describe('mergeRuleLists', () => {
  it('updatedAt 較新的勝出；同時間時刪除優先', () => {
    const a = rule({ label: 'A', updatedAt: T0 })
    const b = rule({ label: 'B', updatedAt: T0 + 1 })
    expect(mergeRuleLists([a], [b])[0]!.label).toBe('B')
    expect(mergeRuleLists([b], [a])[0]!.label).toBe('B')
    const del = rule({ deletedAt: T0, updatedAt: T0 })
    expect(mergeRuleLists([a], [del])[0]!.deletedAt).toBe(T0)
  })
})

describe('rekeyOwner', () => {
  it('把自己的 id 換成雲端身分：擁有者、成員、建立者、修改者、白名單、規則', () => {
    const local = { ...dad(), items: [makeItem({ id: 'a', spaceId: 'sp-family', createdBy: U.dad, updatedBy: U.dad, visibility: { mode: 'selected_members', allowedUserIds: [U.dad, U.kid], hiddenUserIds: [U.dad] } })] }
    const r = rekeyOwner(local, U.dad, 'cloud-id')
    const json = JSON.stringify(r)
    expect(json).not.toContain(U.dad)
    expect(r.ownerId).toBe('cloud-id')
    expect(r.spaces[1]!.members.map((m) => m.userId)).toEqual(['cloud-id', U.coworker])
    expect(r.items[0]).toMatchObject({ createdBy: 'cloud-id', updatedBy: 'cloud-id', visibility: { allowedUserIds: ['cloud-id', U.kid], hiddenUserIds: ['cloud-id'] } })
    expect(r.busyProjectionRules[0]!.userId).toBe('cloud-id')
    expect(rekeyOwner(local, U.dad, U.dad)).toBe(local)
  })
})

describe('prepareSpacesRestore', () => {
  it('還原的資料版本號比目前大、時間是現在；快照裡沒有的改成軟刪除，下次同步不會被蓋回去', () => {
    const snap = dad()
    const current = structuredClone(snap)
    current.items[0] = { ...current.items[0]!, title: '週會（被改壞）', version: 5, updatedAt: T0 + 50 }
    current.items.push(makeItem({ id: 'new', spaceId: 'sp-family', createdBy: U.dad, title: '快照後新增' }))
    current.busyProjectionRules.push(rule({ id: 'r2' }))
    const now = T0 + 100

    const r = prepareSpacesRestore(JSON.parse(JSON.stringify(snap)), current, now)
    const a = r.items.find((i) => i.id === 'a')!
    expect(a).toMatchObject({ title: '週會', version: 6, updatedAt: now })
    expect(r.items.find((i) => i.id === 'new')).toMatchObject({ deletedAt: now, version: 2 })
    expect(r.busyProjectionRules.find((x) => x.id === 'r2')!.deletedAt).toBe(now)
    expect(spacesCountsOf(r)).toEqual({ spaces: 2, items: 2 })

    // 雲端還留著被改壞的 v5：套用後仍是還原的版本
    const pulled = applyPulled(r, { payloads: buildViewerExport(current, U.dad, T0 + 60), rules: current.busyProjectionRules }, U.dad)
    expect(pulled.data.items.find((i) => i.id === 'a')!.title).toBe('週會')
    expect(pulled.data.items.find((i) => i.id === 'new')!.deletedAt).toBe(now)
  })

  it('身分對齊過時，快照裡的舊身分換成現在的；壞掉的快照丟出錯誤', () => {
    const snap = dad()
    const current = rekeyOwner(dad(), U.dad, 'cloud-id')
    const r = prepareSpacesRestore(snap, current, T0 + 1)
    expect(JSON.stringify(r)).not.toContain(U.dad)
    expect(() => prepareSpacesRestore({ nope: 1 }, current, T0)).toThrow()
  })
})
