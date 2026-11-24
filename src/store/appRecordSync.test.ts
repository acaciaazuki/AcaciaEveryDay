import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyAppData, type AppData } from '../core/schema'

vi.mock('../adapters/googleAuth', () => ({
  restoreToken: () => null,
  signIn: async () => ({ token: 'tok', expiresAt: Date.now() + 3600_000 }),
  signOut: async () => {},
  fetchProfile: async () => ({ name: 'QQ' }),
}))

/** 假的 Google Drive：上傳時存成 JSON 再讀回（跟真的一樣是複本） */
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
const cloud = () => JSON.parse(files['acacia_data_v2.json']!) as AppData
const titles = (d: Pick<AppData, 'tasks'>) => d.tasks.map((x) => x.title).sort()
const st = () => useAppStore.getState()

/** 同一個 store 輪流扮演兩台裝置：存下各自的本機資料 */
const save = () => st().exportData()
const use = (d: AppData) => useAppStore.setState(d)

describe('主資料逐筆同步（模擬兩台裝置）', () => {
  beforeEach(() => {
    for (const k of Object.keys(files)) delete files[k]
    useAppStore.setState({ ...emptyAppData(), syncMeta: undefined })
    useSyncStore.setState({ status: 'signedOut', token: null, fileId: null, profile: null })
  })

  it('store 的修改會自動記錄：新增、修改記時間，刪除留下刪除標記', () => {
    st().addTask({ title: '寫報告', loc: '', date: '', time: '' })
    const id = st().tasks[0]!.id
    expect(st().syncMeta!.t[`tasks:${id}`]).toBeGreaterThan(0)
    st().removeTask(id)
    expect(st().syncMeta!.del[`tasks:${id}`]).toBeGreaterThan(0)
    expect(st().syncMeta!.t).not.toHaveProperty(`tasks:${id}`)
  })

  it('兩台裝置離線各自新增、修改、刪除，再各自同步：兩邊的修改都保留，最後內容一致', async () => {
    // 手機先建立資料並同步
    st().addTask({ title: '買牛奶', loc: '', date: '', time: '' })
    st().addTask({ title: '繳電費', loc: '', date: '', time: '' })
    await useSyncStore.getState().connect(true)
    const phone0 = save()
    // 筆電登入同一個帳號，拿到同一份資料
    use({ ...emptyAppData(), syncMeta: undefined })
    useSyncStore.setState({ token: null, fileId: null })
    await useSyncStore.getState().connect(true)
    expect(titles(st())).toEqual(['繳電費', '買牛奶'])
    const laptop0 = save()

    // 兩台都離線：手機改「買牛奶」並新增一筆；筆電刪「繳電費」並新增一筆
    await new Promise((r) => setTimeout(r, 5))
    use(phone0)
    const milk = st().tasks.find((x) => x.title === '買牛奶')!.id
    st().updateTask(milk, { title: '買牛奶（兩瓶）' })
    st().addTask({ title: '手機新增', loc: '', date: '', time: '' })
    const phone1 = save()
    use(laptop0)
    st().removeTask(st().tasks.find((x) => x.title === '繳電費')!.id)
    st().addTask({ title: '筆電新增', loc: '', date: '', time: '' })
    const laptop1 = save()

    // 筆電先恢復連線同步，手機之後才同步
    use(laptop1)
    await useSyncStore.getState().push()
    use(phone1)
    await useSyncStore.getState().push()
    expect(titles(st())).toEqual(['手機新增', '筆電新增', '買牛奶（兩瓶）'])
    expect(titles(cloud())).toEqual(['手機新增', '筆電新增', '買牛奶（兩瓶）'])

    // 筆電再同步一次：拿到手機的修改，兩台一致
    use(laptop1)
    await useSyncStore.getState().push()
    expect(titles(st())).toEqual(['手機新增', '筆電新增', '買牛奶（兩瓶）'])
  })

  it('雲端是舊版 App 寫的（沒有修改紀錄）：照樣逐筆合併，不會整份覆蓋', async () => {
    files['acacia_data_v2.json'] = JSON.stringify({ ...emptyAppData(), updatedAt: 500, tasks: [{ id: 'old', title: '舊版 App 的待辦', loc: '', date: '', time: '', done: false }] })
    st().addTask({ title: '新版 App 的待辦', loc: '', date: '', time: '' })
    await useSyncStore.getState().connect(true)
    expect(titles(st())).toEqual(['新版 App 的待辦', '舊版 App 的待辦'])
    expect(cloud().syncMeta).toBeDefined()
  })

  it('雲端內容跟合併結果相同時不重新上傳', async () => {
    st().addTask({ title: 'a', loc: '', date: '', time: '' })
    await useSyncStore.getState().connect(true)
    const before = files['acacia_data_v2.json']
    await useSyncStore.getState().push()
    expect(files['acacia_data_v2.json']).toBe(before)
  })
})
