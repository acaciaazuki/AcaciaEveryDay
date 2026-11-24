import { describe, expect, it } from 'vitest'

/**
 * 防繞過掃描：畫面（pages、components、hooks、app）不能直接讀共享行程原始資料，
 * 一律透過 useVisibleCalendar（會經過 resolveCalendarItemForViewer 過濾與遮罩）。
 * 允許讀取空間清單、成員與投射規則（設定頁需要），但不能碰 items。
 */
// 跟 AcaciaIcons.test 一樣用 Vite 的 import.meta.glob 讀原始碼（不需要 Node 型別）
const sources = import.meta.glob(['../pages/**/*.{ts,tsx}', '../components/**/*.{ts,tsx}', '../hooks/**/*.{ts,tsx}', '../app/**/*.{ts,tsx}', '!../**/*.test.*'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const ALLOWED = new Set(['../hooks/useVisibleCalendar.ts'])
/** selector 直接取出整包 data，或是取到 items */
const re = /useSpacesStore\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\1\.data\s*\)|useSpacesStore\(\s*\(?\s*\w+\s*\)?\s*=>[^)]*\.items/


describe('共享行程只能經過權限過濾後讀取', () => {
  const targets = Object.entries(sources).map(([rel, src]) => ({ rel, src }))

  it('有掃描到檔案（含唯一允許的入口）', () => {
    expect(targets.length).toBeGreaterThan(20)
    expect(targets.map((f) => f.rel)).toEqual(expect.arrayContaining([...ALLOWED, '../pages/CalendarPage.tsx', '../components/EventDialog.tsx']))
  })

  it.each(['data.items', 'data?.items', 'exportSpaces', 'useSpacesStore()', 'useSpacesStore.getState().data'])('沒有畫面直接使用 %s', (pattern) => {
    const offenders = targets.filter((f) => !ALLOWED.has(f.rel) && f.src.includes('useSpacesStore') && f.src.includes(pattern)).map((f) => f.rel)
    expect(offenders).toEqual([])
  })

  it('沒有畫面用 selector 取出整包 data 或 items', () => {
    const offenders = targets.filter((f) => !ALLOWED.has(f.rel) && re.test(f.src)).map((f) => f.rel)
    expect(offenders).toEqual([])
  })

  it('掃描規則本身有效：放一段違規程式碼會被抓到', () => {
    expect(re.test('const d = useSpacesStore((s) => s.data)')).toBe(true)
    expect(re.test('const i = useSpacesStore((s) => s.data.items)')).toBe(true)
    expect(re.test('const sp = useSpacesStore((s) => s.data.spaces)')).toBe(false)
  })
})
