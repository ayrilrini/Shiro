import { describe, expect, it } from 'vitest'

import {
  buildWsUrl,
  mapEventName,
  parseInboundEnvelope,
  toEmitEnvelope,
  toWsScheme,
} from './protocol'

describe('mapEventName（v14 点分事件名 → Shiro 全大写事件名）', () => {
  it.each([
    ['gateway.connect', 'GATEWAY_CONNECT'],
    ['gateway.disconnect', 'GATEWAY_DISCONNECT'],
    ['visitor.online', 'VISITOR_ONLINE'],
    ['visitor.offline', 'VISITOR_OFFLINE'],
    ['post.create', 'POST_CREATE'],
    ['post.update', 'POST_UPDATE'],
    ['post.delete', 'POST_DELETE'],
    ['note.create', 'NOTE_CREATE'],
    ['note.update', 'NOTE_UPDATE'],
    ['note.delete', 'NOTE_DELETE'],
    ['page.update', 'PAGE_UPDATE'],
    ['say.create', 'SAY_CREATE'],
    ['say.update', 'SAY_UPDATE'],
    ['say.delete', 'SAY_DELETE'],
    ['comment.create', 'COMMENT_CREATE'],
    ['recently.create', 'RECENTLY_CREATE'],
    ['recently.delete', 'RECENTLY_DELETE'],
    ['translation.create', 'TRANSLATION_CREATE'],
    ['translation.update', 'TRANSLATION_UPDATE'],
    ['activity.update_presence', 'ACTIVITY_UPDATE_PRESENCE'],
    ['activity.leave_presence', 'ACTIVITY_LEAVE_PRESENCE'],
    ['article.read_count_update', 'ARTICLE_READ_COUNT_UPDATE'],
  ])('%s → %s', (input, expected) => {
    expect(mapEventName(input)).toBe(expected)
  })
})

describe('toEmitEnvelope（Shiro 上行指令 → v14 信封）', () => {
  it('updateSid → session.update', () => {
    expect(
      toEmitEnvelope({ type: 'updateSid', payload: { sessionId: 's1' } }),
    ).toEqual({
      v: 1,
      event: 'session.update',
      payload: { sessionId: 's1' },
    })
  })

  it('updateLang → lang.update', () => {
    expect(
      toEmitEnvelope({ type: 'updateLang', payload: { lang: 'zh' } }),
    ).toEqual({
      v: 1,
      event: 'lang.update',
      payload: { lang: 'zh' },
    })
  })

  it('join / leave → room.join / room.leave', () => {
    expect(
      toEmitEnvelope({ type: 'join', payload: { room: 'r1' } })?.event,
    ).toBe('room.join')
    expect(
      toEmitEnvelope({ type: 'leave', payload: { room: 'r1' } })?.event,
    ).toBe('room.leave')
  })

  it('未知指令返回 null', () => {
    expect(toEmitEnvelope({ type: 'unknown', payload: {} })).toBeNull()
  })
})

describe('toWsScheme', () => {
  it('http → ws', () => {
    expect(toWsScheme('http://localhost:2333')).toBe('ws://localhost:2333')
  })

  it('https → wss', () => {
    expect(toWsScheme('https://api.example.com')).toBe('wss://api.example.com')
  })

  it('已是 ws(s) 协议时保持不变', () => {
    expect(toWsScheme('wss://api.example.com')).toBe('wss://api.example.com')
  })
})

describe('buildWsUrl', () => {
  it('携带 socket_session_id', () => {
    expect(
      buildWsUrl({
        url: 'wss://api.example.com/ws/web',
        socket_session_id: 'abc123',
      }),
    ).toBe('wss://api.example.com/ws/web?socket_session_id=abc123')
  })

  it('携带可选 lang', () => {
    const url = buildWsUrl({
      url: 'wss://api.example.com/ws/web',
      socket_session_id: 'abc123',
      lang: 'zh',
    })
    expect(url).toContain('socket_session_id=abc123')
    expect(url).toContain('lang=zh')
  })

  it('未提供 lang 时不带 lang 参数', () => {
    expect(
      buildWsUrl({
        url: 'wss://api.example.com/ws/web',
        socket_session_id: 'abc123',
      }),
    ).not.toContain('lang=')
  })
})

describe('parseInboundEnvelope', () => {
  it('解析合法信封', () => {
    expect(
      parseInboundEnvelope(
        JSON.stringify({
          v: 1,
          event: 'visitor.online',
          payload: { online: 3 },
        }),
      ),
    ).toEqual({ event: 'visitor.online', payload: { online: 3 } })
  })

  it('无 payload 的信封', () => {
    expect(
      parseInboundEnvelope(JSON.stringify({ v: 1, event: 'gateway.connect' })),
    ).toEqual({ event: 'gateway.connect', payload: undefined })
  })

  it('非法 JSON 返回 null', () => {
    expect(parseInboundEnvelope('not-json{')).toBeNull()
  })

  it('缺少 event 字段返回 null', () => {
    expect(
      parseInboundEnvelope(JSON.stringify({ v: 1, payload: 1 })),
    ).toBeNull()
  })
})
