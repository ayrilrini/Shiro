import { rgbaToThumbHash } from 'thumbhash'
import { describe, expect, it } from 'vitest'

import { thumbhashBase64ToDataUrl } from './image'

// 与后端 helper.image.service.ts 相同的生成方式：
// rgbaToThumbHash → Buffer.toString('base64')
const makeThumbhashBase64 = () => {
  const width = 4
  const height = 4
  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 0x33
    rgba[i + 1] = 0xa6
    rgba[i + 2] = 0xb8
    rgba[i + 3] = 0xff
  }
  const u8 = rgbaToThumbHash(width, height, rgba)
  return Buffer.from(u8).toString('base64')
}

describe('thumbhashBase64ToDataUrl', () => {
  it('将后端 base64 thumbhash 解码为 PNG data URL', () => {
    const dataUrl = thumbhashBase64ToDataUrl(makeThumbhashBase64())
    expect(dataUrl).toMatch(/^data:image\/png/)
  })

  it('非法 base64 返回 undefined', () => {
    expect(thumbhashBase64ToDataUrl('!!!not-base64!!!')).toBeUndefined()
  })

  it('thumbhash 解码器对垃圾内容宽容，仍返回 data URL', () => {
    // thumbHashToDataURL 不校验内容，仅 atob 非法时才返回 undefined
    expect(
      thumbhashBase64ToDataUrl(Buffer.from('garbage-bytes').toString('base64')),
    ).toMatch(/^data:image\/png/)
  })
})
