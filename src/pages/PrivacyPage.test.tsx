import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { PrivacyPage } from './PrivacyPage'
import { CONTACT_EMAIL, POLICIES } from './privacy/policy'

const shape = (lng: keyof typeof POLICIES) =>
  POLICIES[lng].sections.map((s) => [s.id, s.blocks.map((b) => (typeof b === 'string' ? 'p' : 'sub' in b ? 'h' : `ul${b.list.length}`))])

describe('隱私權政策', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
  })

  it('三種語言的章節與段落結構一致', () => {
    expect(shape('ja')).toEqual(shape('zh-TW'))
    expect(shape('en')).toEqual(shape('zh-TW'))
    expect(POLICIES.ja.summary).toHaveLength(POLICIES['zh-TW'].summary.length)
    expect(POLICIES.en.summary).toHaveLength(POLICIES['zh-TW'].summary.length)
  })

  it('顯示日期、各章節、Email 與外部連結', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: '隱私權政策' })).toBeInTheDocument()
    expect(screen.getAllByText('2026-11-22')).toHaveLength(2)
    for (const h of ['2. 我們處理哪些資料', '3. 資料儲存位置與傳輸安全', '4. 第三方服務', '6. 你的權利與資料控制', '9. 聯絡我們']) {
      expect(screen.getByRole('heading', { level: 2, name: h })).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: CONTACT_EMAIL })).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`)
    const limited = screen.getByRole('link', { name: 'https://developers.google.com/terms/api-services-user-data-policy' })
    expect(limited).toHaveAttribute('target', '_blank')
    // 網址後面的全形括號不會被吃進連結
    expect(screen.getByRole('link', { name: 'https://myaccount.google.com/connections' })).toBeInTheDocument()
    const toc = screen.getByRole('navigation', { name: '目錄' })
    expect(within(toc).getAllByRole('link')).toHaveLength(POLICIES['zh-TW'].sections.length)
  })

  it('依介面語言切換成英文', async () => {
    await i18n.changeLanguage('en')
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument()
    expect(screen.getByText(/Limited Use requirements/)).toBeInTheDocument()
  })

  it('據實描述：未要求 Email、不另外加密、使用 IndexedDB', () => {
    const all = JSON.stringify(POLICIES['zh-TW'])
    expect(all).toContain('不會要求你的 Email')
    expect(all).toContain('不會對資料另外做端對端加密')
    expect(all).toContain('IndexedDB')
    expect(all).not.toContain('加密上傳')
    // 地點搜尋服務的程式不在這個 repo，不寫無法驗證的「不保存」保證
    expect(all).not.toContain('不保存或分析')
    expect(all).toContain('bold-cloud-4bb3.s3311453038.workers.dev')
  })
})
