import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { useSpacesStore } from '../store/useSpacesStore'
import { SpacesBlockedBanner } from './SpaceSwitcher'

describe('寫入保護的提示橫幅', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useSpacesStore.getState().reset()
  })
  afterEach(() => useSpacesStore.setState({ blockedReason: null }))

  it('平常不顯示', () => {
    const { container } = render(<SpacesBlockedBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('寫入保護中：提示已暫停修改與同步、請先更新 App，資料會保留', () => {
    useSpacesStore.setState({ blockedReason: '來自較新版本' })
    render(<SpacesBlockedBanner />)
    expect(screen.getByRole('alert')).toHaveTextContent('已暫停修改與同步，請先更新 App；資料會完整保留')
  })
})
