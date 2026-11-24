import 'fake-indexeddb/auto'
import { get } from 'idb-keyval'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionError } from '../core/permissions'
import { emptyAppData } from '../core/schema'
import { U } from '../test/sharingFixtures'
import { loadSeed, LEAK } from '../test/spacesSeed'

vi.mock('../adapters/googleAuth', () => ({
  restoreToken: () => null,
  signIn: async () => ({ token: 'tok', expiresAt: Date.now() + 3600_000 }),
  signOut: async () => {},
  fetchProfile: async () => ({ name: 'QQ' }),
}))

const { useSpacesStore, PreviewModeError, SPACES_STORAGE_KEY } = await import('./useSpacesStore')
const { useAppStore } = await import('./useAppStore')
const { deleteAllData } = await import('./deleteAllData')

/** zustand persist 寫入 IndexedDB 是非同步的，等它寫完 */
const flush = () => new Promise((r) => setTimeout(r, 20))
const stored = async () => {
  const raw = await get<string>(SPACES_STORAGE_KEY)
  return raw ? (JSON.parse(raw) as { state: Record<string, unknown> }).state : null
}

describe('useSpacesStore：空間與成員', () => {
  beforeEach(() => useSpacesStore.getState().reset())

  it('第一次使用產生 local- 開頭的 selfId，資料擁有者就是自己', () => {
    const s = useSpacesStore.getState()
    expect(s.selfId).toMatch(/^local-/)
    expect(s.data.ownerId).toBe(s.selfId)
    expect(s.viewerId).toBe(s.selfId)
  })

  it('自由新增空間、模擬成員與角色；只有 owner 能管理', () => {
    const st = useSpacesStore.getState()
    const id = st.createSpace({ name: '週末登山社', kind: 'personal' })
    const mom = st.addMember(id, { displayName: ' 媽媽 ', role: 'editor' })
    expect(mom).toMatch(/^sim-/)
    st.updateMember(id, mom, { role: 'viewer' })
    const space = useSpacesStore.getState().data.spaces[0]!
    expect(space).toMatchObject({ name: '週末登山社', kind: 'personal' })
    expect(space.members.find((m) => m.userId === mom)).toMatchObject({ displayName: '媽媽', role: 'viewer' })
    st.renameSpace(id, '登山社')
    expect(useSpacesStore.getState().data.spaces[0]!.name).toBe('登山社')
  })

  it('刪除空間：軟刪除，相關的投射規則也標記刪除（才會同步到其他裝置）', () => {
    const st = useSpacesStore.getState()
    const a = st.createSpace({ name: '家', kind: 'family' })
    const b = st.createSpace({ name: '公司', kind: 'work' })
    st.addRule({ sourceSpaceId: b, targetSpaceId: a, label: '上班中' })
    st.setFilter(b)
    st.deleteSpace(b)
    const s = useSpacesStore.getState()
    expect(s.data.spaces.find((x) => x.id === b)?.deletedAt).not.toBeNull()
    expect(s.data.busyProjectionRules).toHaveLength(1)
    expect(s.data.busyProjectionRules[0]!.deletedAt).not.toBeNull()
    expect(s.filter).toBe('all')
  })
})

describe('useSpacesStore：行程與權限', () => {
  beforeEach(() => loadSeed())

  it('新增、編輯、軟刪除自己的行程，版本遞增', () => {
    const st = useSpacesStore.getState()
    const id = st.addItem('sp-family', { title: '接奶奶', dateISO: '2026-12-01', start: '08:00', end: '09:00', kind: 'medical_ride' })
    st.updateItem(id, { title: '接奶奶回診', visibility: { mode: 'busy_only' } })
    let item = useSpacesStore.getState().data.items.find((i) => i.id === id)!
    expect(item).toMatchObject({ title: '接奶奶回診', createdBy: U.dad, version: 2, visibility: { mode: 'busy_only' } })
    st.removeItem(id)
    item = useSpacesStore.getState().data.items.find((i) => i.id === id)!
    expect(item.deletedAt).not.toBeNull()
    expect(item.version).toBe(3)
  })

  it('別人的行程：可以改內容，但不能改可見性', () => {
    const st = useSpacesStore.getState()
    st.updateItem('dinner', { title: '週日家庭聚餐（改晚上）' })
    expect(useSpacesStore.getState().data.items.find((i) => i.id === 'dinner')!.updatedBy).toBe(U.dad)
    expect(() => st.updateItem('dinner', { visibility: { mode: 'private' } })).toThrow(PermissionError)
    // 看不到的行程也不能改
    expect(() => st.updateItem('surprise', { title: 'x' })).toThrow(PermissionError)
  })

  it('預覽其他成員的視角時所有修改都被拒絕', () => {
    const st = useSpacesStore.getState()
    st.setViewer(U.mom)
    const before = useSpacesStore.getState().data
    expect(() => st.addItem('sp-family', { title: 'x', dateISO: '2026-12-01' })).toThrow(PreviewModeError)
    expect(() => st.updateItem('dinner', { title: 'x' })).toThrow(PreviewModeError)
    expect(() => st.removeItem('dinner')).toThrow(PreviewModeError)
    expect(() => st.createSpace({ name: 'x', kind: 'work' })).toThrow(PreviewModeError)
    expect(() => st.addRule({ sourceSpaceId: 'sp-work', targetSpaceId: 'sp-family' })).toThrow(PreviewModeError)
    expect(useSpacesStore.getState().data).toBe(before)
  })

  it('viewer 角色不能在空間新增行程；非 owner 不能管理成員', () => {
    // 本人在家人空間降為 viewer：改由媽媽當 owner 的情境
    const data = useSpacesStore.getState().data
    const family = data.spaces[0]!
    const members = family.members.map((m) => (m.userId === U.dad ? { ...m, role: 'viewer' as const } : m.userId === U.mom ? { ...m, role: 'owner' as const } : m))
    useSpacesStore.setState({ data: { ...data, spaces: [{ ...family, members }, data.spaces[1]!] } })
    const st = useSpacesStore.getState()
    expect(() => st.addItem('sp-family', { title: 'x', dateISO: '2026-12-01' })).toThrow(PermissionError)
    expect(() => st.addMember('sp-family', { displayName: 'x', role: 'viewer' })).toThrow(PermissionError)
  })

  it('owner 可以移除成員', () => {
    useSpacesStore.getState().removeMember('sp-work', U.coworker)
    expect(useSpacesStore.getState().data.spaces[1]!.members.map((m) => m.userId)).toEqual([U.dad])
  })

  it('匯出／匯入接口：只接受自己的資料，格式錯誤不覆蓋', () => {
    const st = useSpacesStore.getState()
    const exported = JSON.parse(JSON.stringify(st.exportSpaces()))
    st.importSpaces(exported)
    expect(useSpacesStore.getState().data.items).toHaveLength(6)
    expect(() => st.importSpaces({ ...exported, ownerId: U.mom })).toThrow(PermissionError)
    expect(() => st.importSpaces({ nope: 1 })).toThrow()
    expect(useSpacesStore.getState().data.items).toHaveLength(6)
  })
})

describe('useSpacesStore：持久化與資料邊界', () => {
  beforeEach(() => {
    useAppStore.setState(emptyAppData())
    loadSeed()
  })

  it('存進 IndexedDB 的 acacia-spaces，只存身份、資料與雲端同步開關，不存檢視身份與篩選', async () => {
    useSpacesStore.getState().setViewer(U.kid)
    useSpacesStore.getState().setFilter('sp-work')
    await flush()
    const s = await stored()
    expect(Object.keys(s!).sort()).toEqual(['cloudSync', 'data', 'selfId'])
    expect(s!.cloudSync).toBe(false)
    expect(s!.selfId).toBe(U.dad)
  })

  it('重新載入：資料還在，一律回到自己的視角', async () => {
    useSpacesStore.getState().setViewer(U.kid)
    useSpacesStore.getState().setFilter('sp-work')
    await flush()
    await useSpacesStore.persist.rehydrate()
    const s = useSpacesStore.getState()
    expect(s.viewerId).toBe(U.dad)
    expect(s.filter).toBe('all')
    expect(s.data.items.map((i) => i.id)).toContain('dinner')
  })

  it('壞掉的資料不會被載入', async () => {
    const { set } = await import('idb-keyval')
    await set(SPACES_STORAGE_KEY, JSON.stringify({ state: { selfId: U.dad, data: { schemaVersion: 1, ownerId: U.mom } }, version: 1 }))
    const before = useSpacesStore.getState().data
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await useSpacesStore.persist.rehydrate()
    expect(useSpacesStore.getState().data).toBe(before)
    spy.mockRestore()
  })

  it('共享資料不會進入主資料的 exportData（acacia_data_v2.json 與自動備份）', async () => {
    useAppStore.getState().addEvent({ title: '個人行程', dateISO: '2026-12-01', start: '', end: '', note: '' })
    const json = JSON.stringify(useAppStore.getState().exportData())
    expect(json).not.toMatch(new RegExp(Object.values(LEAK).join('|')))
    expect(json).not.toContain('sp-family')
    await flush()
    const main = await get<string>('acacia-next')
    expect(main).not.toContain('sp-family')
  })

  it('同意紀錄（acacia-consent）不會被存進 acacia-spaces', async () => {
    await flush()
    expect(JSON.stringify(await stored())).not.toContain('acacia-consent')
  })

  it('刪除所有資料：清空共享空間並換新的 selfId', async () => {
    await deleteAllData()
    await flush()
    const s = useSpacesStore.getState()
    expect(s.selfId).not.toBe(U.dad)
    expect(s.data.spaces).toEqual([])
    expect(s.data.items).toEqual([])
    expect(JSON.stringify(await stored())).not.toMatch(new RegExp(Object.values(LEAK).join('|')))
  })
})
