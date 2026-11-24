import { describe, expect, it } from 'vitest'
import { canonical, mergeAppData, sameAppData, TOMBSTONE_TTL, trackChanges } from './appMerge'
import { emptyAppData, type AppData, type Task } from './schema'

const task = (id: string, title = id, done = false): Task => ({ id, title, loc: '', date: '', time: '', done })
const place = (id: string): AppData['places'][number] => ({ id, name: id, cat: 'cafe', address: '', hours: '', note: '', url: '' })

/** 模擬一台裝置：從共同的起點開始，依序套用修改（每次修改都經過 trackChanges，就像 store 一樣） */
function device(start: AppData) {
  let data = start
  return {
    edit(at: number, patch: Partial<AppData>) {
      const next = { ...data, ...patch, updatedAt: at }
      data = { ...next, syncMeta: trackChanges(data, next, at) }
      return this
    },
    get data() {
      return data
    },
  }
}

const T0 = 1_700_000_000_000
/** 兩台裝置的共同起點：已經同步過一次，有三個待辦、兩個地點 */
const base = (): AppData => {
  const d = { ...emptyAppData(), tasks: [task('a'), task('b'), task('c')], places: [place('p1'), place('p2')], updatedAt: T0 }
  return { ...d, syncMeta: { base: T0, t: {}, del: {} } }
}
const titles = (d: AppData) => d.tasks.map((x) => x.title)

describe('主資料逐筆合併', () => {
  it('兩台裝置離線各自修改不同的紀錄：兩邊的修改都保留（不會整份被蓋掉）', () => {
    const phone = device(base()).edit(T0 + 10, { tasks: [task('a', 'a（手機改）'), task('b'), task('c')] })
    const laptop = device(base()).edit(T0 + 20, { tasks: [task('a'), task('b', 'b（筆電改）'), task('c')] })
    const merged = mergeAppData(phone.data, laptop.data, T0 + 30)
    expect(titles(merged)).toEqual(['a（手機改）', 'b（筆電改）', 'c'])
    expect(merged.updatedAt).toBe(T0 + 20)
  })

  it('兩邊都改了同一筆：較新的修改勝出', () => {
    const phone = device(base()).edit(T0 + 10, { tasks: [task('a', '手機版'), task('b'), task('c')] })
    const laptop = device(base()).edit(T0 + 20, { tasks: [task('a', '筆電版'), task('b'), task('c')] })
    expect(titles(mergeAppData(phone.data, laptop.data, T0 + 30))[0]).toBe('筆電版')
    expect(titles(mergeAppData(laptop.data, phone.data, T0 + 30))[0]).toBe('筆電版')
  })

  it('離線新增的紀錄兩邊都保留；一邊刪除、另一邊沒動：刪除會同步過去', () => {
    const phone = device(base()).edit(T0 + 10, { tasks: [task('a'), task('b'), task('c'), task('手機新增')] })
    const laptop = device(base()).edit(T0 + 20, { tasks: [task('a'), task('c'), task('筆電新增')] })
    const merged = mergeAppData(phone.data, laptop.data, T0 + 30)
    expect(titles(merged).sort()).toEqual(['a', 'c', '手機新增', '筆電新增'].sort())
    expect(merged.syncMeta!.del['tasks:b']).toBe(T0 + 20)
  })

  it('一邊刪除、另一邊之後又修改：保留修改；刪除比修改晚：刪除', () => {
    const deletedEarly = device(base()).edit(T0 + 10, { tasks: [task('a'), task('c')] })
    const editedLater = device(base()).edit(T0 + 20, { tasks: [task('a'), task('b', '後來改的'), task('c')] })
    expect(titles(mergeAppData(deletedEarly.data, editedLater.data, T0 + 30))).toContain('後來改的')

    const editedEarly = device(base()).edit(T0 + 10, { tasks: [task('a'), task('b', '先改的'), task('c')] })
    const deletedLater = device(base()).edit(T0 + 20, { tasks: [task('a'), task('c')] })
    expect(titles(mergeAppData(editedEarly.data, deletedLater.data, T0 + 30))).toEqual(['a', 'c'])
  })

  it('順序：較新的排序為準，另一邊新增的接在後面', () => {
    const phone = device(base()).edit(T0 + 10, { places: [place('p2'), place('p1')] })
    const laptop = device(base()).edit(T0 + 20, { places: [place('p1'), place('p2'), place('p3')] })
    expect(mergeAppData(phone.data, laptop.data, T0 + 30).places.map((p) => p.id)).toEqual(['p2', 'p1', 'p3'])
  })

  it('設定逐欄位合併：手機改幣別、筆電改字體大小，兩個都保留；清掉的欄位也會同步', () => {
    const start = { ...base(), settings: { ...base().settings, holidayCountry: 'TW' } }
    const phone = device(start).edit(T0 + 10, { settings: { ...start.settings, currency: 'JPY' } })
    const { holidayCountry: _hc, ...withoutCountry } = start.settings
    void _hc
    const laptop = device(start).edit(T0 + 20, { settings: { ...withoutCountry, fontSize: 'lg' } })
    const merged = mergeAppData(phone.data, laptop.data, T0 + 30)
    expect(merged.settings).toMatchObject({ currency: 'JPY', fontSize: 'lg' })
    expect(merged.settings).not.toHaveProperty('holidayCountry')
  })

  it('合併結果跟順序無關：哪一台先合併都一樣', () => {
    const phone = device(base())
      .edit(T0 + 10, { tasks: [task('a', '手機'), task('b'), task('c'), task('x')] })
      .edit(T0 + 15, { places: [place('p2'), place('p1')] })
    const laptop = device(base()).edit(T0 + 20, { tasks: [task('a'), task('c', '筆電'), task('y')] })
    const ab = mergeAppData(phone.data, laptop.data, T0 + 30)
    const ba = mergeAppData(laptop.data, phone.data, T0 + 30)
    expect(canonical(ab.tasks.map((x) => x.id).sort())).toBe(canonical(ba.tasks.map((x) => x.id).sort()))
    expect(canonical(ab.syncMeta)).toBe(canonical(ba.syncMeta))
    expect(ab.places).toEqual(ba.places)
    // 再合併一次不會再改變（兩台同步後內容一致）
    expect(sameAppData(mergeAppData(ab, ba, T0 + 40), ab)).toBe(true)
    // 兩邊都已經刪掉的紀錄，刪除標記仍然保留（還沒同步的裝置不會把它帶回來）
    expect(mergeAppData(ab, ba, T0 + 40).syncMeta!.del).toHaveProperty('tasks:b')
    const stale = base()
    expect(titles(mergeAppData(mergeAppData(ab, ba, T0 + 40), stale, T0 + 50))).not.toContain('b')
  })

  it('舊版資料（沒有修改紀錄）：以整份 updatedAt 為每一筆的時間，只在一邊的紀錄保留不刪', () => {
    const legacyOld: AppData = { ...emptyAppData(), tasks: [task('a', '舊版'), task('only-old')], updatedAt: T0 }
    const legacyNew: AppData = { ...emptyAppData(), tasks: [task('a', '較新'), task('only-new')], updatedAt: T0 + 50 }
    const merged = mergeAppData(legacyOld, legacyNew, T0 + 60)
    expect(titles(merged).sort()).toEqual(['only-new', 'only-old', '較新'].sort())
    // 新版有修改紀錄、雲端是舊版：本機在舊版之後的修改勝出
    const upgraded = device({ ...legacyOld }).edit(T0 + 80, { tasks: [task('a', '新版改的'), task('only-old')] })
    expect(titles(mergeAppData(upgraded.data, legacyNew, T0 + 90))).toContain('新版改的')
  })

  it('太舊的刪除標記會清掉，修改紀錄不會無限長大', () => {
    const d = device(base()).edit(T0 + 10, { tasks: [task('a'), task('c')] })
    expect(mergeAppData(d.data, base(), T0 + 20).syncMeta!.del).toHaveProperty('tasks:b')
    expect(mergeAppData(d.data, d.data, T0 + 10 + TOMBSTONE_TTL + 1).syncMeta!.del).not.toHaveProperty('tasks:b')
  })
})

describe('修改紀錄 trackChanges', () => {
  it('只記錄真的有變的紀錄；內容相同但物件不同不算修改', () => {
    const start = base()
    const meta = trackChanges(start, { ...start, tasks: start.tasks.map((x) => ({ ...x })) }, T0 + 5)
    expect(meta.t).toEqual({})
    const meta2 = trackChanges(start, { ...start, tasks: [task('a', '改'), start.tasks[1]!, start.tasks[2]!] }, T0 + 5)
    expect(meta2.t).toEqual({ 'tasks:a': T0 + 5 })
  })

  it('刪除留下刪除標記；加回來時清掉；只有順序改變才記錄順序', () => {
    const start = base()
    const removed = trackChanges(start, { ...start, tasks: [task('a'), task('c')] }, T0 + 5)
    expect(removed.del).toEqual({ 'tasks:b': T0 + 5 })
    expect(removed.t).not.toHaveProperty('tasks:$order')
    const back = trackChanges({ ...start, tasks: [task('a'), task('c')], syncMeta: removed }, start, T0 + 6)
    expect(back.del).toEqual({})
    expect(back.t['tasks:b']).toBe(T0 + 6)
    expect(trackChanges(start, { ...start, places: [place('p2'), place('p1')] }, T0 + 7).t).toEqual({ 'places:$order': T0 + 7 })
  })

  it('舊資料第一次修改：開始記錄，之前的資料當作舊的 updatedAt', () => {
    const legacy: AppData = { ...emptyAppData(), tasks: [task('a')], updatedAt: T0 }
    expect(trackChanges(legacy, { ...legacy, tasks: [task('a'), task('b')] }, T0 + 5)).toEqual({ base: T0, t: { 'tasks:b': T0 + 5 }, del: {} })
  })

  it('還原快照當成現在的修改：之後跟雲端合併時以還原結果為準，不會被蓋掉', async () => {
    const { prepareRestore } = await import('./backup')
    const snapshot = base()
    // 快照之後：本機與雲端都改了 a、刪了 b
    const current = device(base()).edit(T0 + 100, { tasks: [task('a', '快照後改的'), task('c')] }).data
    const restored = prepareRestore(snapshot, T0 + 200, current)
    const merged = mergeAppData(restored, current, T0 + 300)
    expect(titles(merged)).toEqual(['a', 'b', 'c'])
  })
})

describe('合併結果沿用本機的物件', () => {
  it('跟本機內容一樣的清單與設定沿用原本的參照（套用時畫面不用整個重畫）', () => {
    const local = { ...emptyAppData(), events: [{ id: 'e1', title: '看牙醫', dateISO: '2026-12-01', start: '10:00', end: '11:00', note: '' }], updatedAt: 5 }
    const remote = structuredClone(local)
    const merged = mergeAppData(local, remote, 10)
    expect(merged.events).toBe(local.events)
    expect(merged.tasks).toBe(local.tasks)
    expect(merged.settings).toBe(local.settings)
  })

  it('雲端有新的紀錄時換成新的清單', () => {
    const local = { ...emptyAppData(), updatedAt: 5 }
    const remote = { ...emptyAppData(), events: [{ id: 'e2', title: '健身', dateISO: '2026-12-02', start: '19:00', end: '20:00', note: '' }], updatedAt: 6 }
    const merged = mergeAppData(local, remote, 10)
    expect(merged.events).not.toBe(local.events)
    expect(merged.events.map((e) => e.id)).toEqual(['e2'])
  })
})
