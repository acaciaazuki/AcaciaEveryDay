import { afterEach, describe, expect, it, vi } from 'vitest'
import { DriveError, findFile, isInsufficientPermission } from './drive'

const reply = (status: number, body: unknown) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }))

async function errorOf(p: Promise<unknown>) {
  try {
    await p
  } catch (e) {
    return e
  }
  throw new Error('應該要失敗')
}

describe('Drive 403 錯誤分類', () => {
  afterEach(() => vi.restoreAllMocks())

  it('權限不足（舊格式 errors[].reason）判定為需要重新授權', async () => {
    reply(403, { error: { code: 403, errors: [{ domain: 'global', reason: 'insufficientPermissions' }], message: 'Request had insufficient authentication scopes.' } })
    const e = await errorOf(findFile('tok', 'acacia_data_v2.json'))
    expect(e).toBeInstanceOf(DriveError)
    expect(isInsufficientPermission(e)).toBe(true)
  })

  it('權限不足（新格式 details[].reason）也判定為需要重新授權', async () => {
    reply(403, { error: { code: 403, status: 'PERMISSION_DENIED', details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] } })
    expect(isInsufficientPermission(await errorOf(findFile('tok', 'x')))).toBe(true)
  })

  it('Drive API 未啟用（accessNotConfigured）的 403 不算權限不足', async () => {
    reply(403, { error: { code: 403, errors: [{ reason: 'accessNotConfigured' }], details: [{ reason: 'SERVICE_DISABLED' }] } })
    const e = await errorOf(findFile('tok', 'x'))
    expect(isInsufficientPermission(e)).toBe(false)
    expect((e as DriveError).reasons).toEqual(['accessNotConfigured', 'SERVICE_DISABLED'])
  })

  it('錯誤內容不是 JSON 時不會丟出其他例外', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Forbidden', { status: 403 }))
    const e = await errorOf(findFile('tok', 'x'))
    expect((e as DriveError).status).toBe(403)
    expect(isInsufficientPermission(e)).toBe(false)
  })
})
