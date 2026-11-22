import { describe, expect, it } from 'vitest'
import { addSnapshot, BACKUP_INTERVAL_MS, countsOf, emptyBackupIndex, MAX_SNAPSHOTS, prepareRestore, shouldAutoBackup, type SnapshotMeta } from './backup'
import { emptyAppData } from './schema'

const meta = (id: string, createdAt: number, dataUpdatedAt = createdAt): SnapshotMeta => ({
  id,
  createdAt,
  reason: 'auto',
  dataUpdatedAt,
  counts: { events: 0, tasks: 0, shopping: 0, inventory: 0, subscriptions: 0 },
})

describe('自動備份判斷', () => {
  const now = 1_000_000_000_000

  it('第一次、有資料時備份；沒改過資料（updatedAt 0）不備份', () => {
    expect(shouldAutoBackup(emptyBackupIndex(), { updatedAt: 5 }, now)).toBe(true)
    expect(shouldAutoBackup(emptyBackupIndex(), { updatedAt: 0 }, now)).toBe(false)
  })

  it('距上次未滿 12 小時不備份，超過才備份', () => {
    const index = { ...emptyBackupIndex(), lastAt: now - BACKUP_INTERVAL_MS + 1, snapshots: [meta('a', now - BACKUP_INTERVAL_MS + 1, 1)] }
    expect(shouldAutoBackup(index, { updatedAt: 2 }, now)).toBe(false)
    expect(shouldAutoBackup({ ...index, lastAt: now - BACKUP_INTERVAL_MS }, { updatedAt: 2 }, now)).toBe(true)
  })

  it('資料跟最新一份快照相同時不重複備份', () => {
    const index = { ...emptyBackupIndex(), lastAt: 0, snapshots: [meta('a', 0, 42)] }
    expect(shouldAutoBackup(index, { updatedAt: 42 }, now)).toBe(false)
    expect(shouldAutoBackup(index, { updatedAt: 43 }, now)).toBe(true)
  })

  it('關閉自動備份時不備份', () => {
    expect(shouldAutoBackup({ ...emptyBackupIndex(), enabled: false }, { updatedAt: 5 }, now)).toBe(false)
  })
})

describe('快照滾動覆蓋', () => {
  it(`最多保留 ${MAX_SNAPSHOTS} 份，新的在前，回傳被擠掉的舊快照`, () => {
    let list: SnapshotMeta[] = []
    const removed: string[] = []
    for (let i = 1; i <= 9; i++) {
      const r = addSnapshot(list, meta(`s${i}`, i))
      list = r.snapshots
      removed.push(...r.removed)
    }
    expect(list.map((s) => s.id)).toEqual(['s9', 's8', 's7', 's6', 's5', 's4', 's3'])
    expect(removed).toEqual(['s1', 's2'])
  })
})

describe('快照摘要與還原', () => {
  it('記帳筆數包含已歸檔的週期', () => {
    const d = emptyAppData()
    const exp = { id: 'e', title: 'x', amt: 1, store: '', cat: 'food' as const, date: '', time: '', done: false }
    d.shopping = [exp]
    d.archives = [{ start: '2026-10-10', end: '2026-11-09', archivedAt: 0, expenses: [exp, { ...exp, id: 'f' }] }]
    d.tasks = [{ id: 't', title: 't', loc: '', date: '', time: '', done: false }]
    expect(countsOf(d)).toEqual({ events: 0, tasks: 1, shopping: 3, inventory: 0, subscriptions: 0 })
  })

  it('還原時把 updatedAt 改成現在，同步時才會以還原結果為準', () => {
    const d = { ...emptyAppData(), updatedAt: 100 }
    expect(prepareRestore(d, 999).updatedAt).toBe(999)
    expect(d.updatedAt).toBe(100)
  })
})
