import { describe, expect, it } from 'vitest'

import { unwrapV3Envelope } from './request.shared'

describe('unwrapV3Envelope（v14 响应信封解包）', () => {
  it('解包标准信封 { data, meta? }', () => {
    expect(unwrapV3Envelope({ data: { ok: 1 }, meta: {} })).toEqual({ ok: 1 })
    expect(unwrapV3Envelope({ data: { ok: 1 } })).toEqual({ ok: 1 })
  })

  it('解包数组载荷信封', () => {
    expect(unwrapV3Envelope({ data: [1, 2, 3] })).toEqual([1, 2, 3])
  })

  it('解包原始类型载荷', () => {
    expect(unwrapV3Envelope({ data: 'ok' })).toBe('ok')
    expect(unwrapV3Envelope({ data: null })).toBeNull()
  })

  it('无信封的旧形态/异常响应原样返回', () => {
    const legacy = { ok: 1, isGuest: false }
    expect(unwrapV3Envelope(legacy)).toBe(legacy)
    expect(unwrapV3Envelope('plain string')).toBe('plain string')
    expect(unwrapV3Envelope([1, 2])).toEqual([1, 2])
  })

  it('null / undefined 原样返回', () => {
    expect(unwrapV3Envelope(null)).toBeNull()
    expect(unwrapV3Envelope()).toBeUndefined()
  })
})
