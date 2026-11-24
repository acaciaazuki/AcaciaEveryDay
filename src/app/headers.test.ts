import { describe, expect, it } from 'vitest'
import headersFile from '../../public/_headers?raw'

/** 解析 Cloudflare Pages 的 _headers：路徑一行、底下縮排的「名稱: 值」，# 開頭是註解 */
function parse(text: string) {
  const rules = new Map<string, Map<string, string>>()
  let current: Map<string, string> | null = null
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim() || line.trim().startsWith('#')) continue
    if (!/^\s/.test(line)) {
      current = new Map()
      rules.set(line.trim(), current)
    } else if (current) {
      const i = line.indexOf(':')
      current.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim())
    }
  }
  return rules
}

describe('Cloudflare Pages 回應標頭（public/_headers）', () => {
  const rules = parse(headersFile)
  const all = rules.get('/*')!

  it('所有頁面都有基本的安全標頭', () => {
    expect(all.get('x-content-type-options')).toBe('nosniff')
    expect(all.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(all.get('x-frame-options')).toBe('DENY')
  })

  it('不會擋到現有功能：Google 登入的彈出視窗、最愛地點的定位', () => {
    // same-origin 會讓 Google 登入的彈出視窗無法回傳結果
    expect(all.get('cross-origin-opener-policy')).toBe('same-origin-allow-popups')
    expect(all.get('permissions-policy')).toContain('geolocation=(self)')
    // 沒有設定 CSP：Google 登入、字型與地點搜尋都會連外，要另外評估後再加
    expect(all.has('content-security-policy')).toBe(false)
  })

  it('只有檔名含雜湊的 /assets/* 長期快取；HTML 不快取（沿用 Cloudflare 預設，每次確認最新版）', () => {
    expect(rules.get('/assets/*')!.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect([...rules.values()].filter((r) => r.get('cache-control')?.includes('immutable'))).toHaveLength(1)
  })
})
