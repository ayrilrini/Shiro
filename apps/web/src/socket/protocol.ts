/**
 * mx-core v14 原生 WebSocket 协议助手（纯函数，可测试）。
 *
 * 协议（自 mx-core processors/gateway/ws 逆向）：
 * - 端点：/ws/web，query 携带 socket_session_id 与可选 lang
 * - 双向消息均为 JSON 信封：{ v: 1, event, payload?, id? }
 * - 下行事件名为点分小写（visitor.online），映射回 Shiro 的全大写事件名
 * - 上行事件：session.update / lang.update / room.join / room.leave / ping
 */

export const WS_PROTOCOL_VERSION = 1 as const

export interface WsEnvelope {
  v: typeof WS_PROTOCOL_VERSION
  event: string
  payload?: unknown
  id?: string
}

export interface WorkerConfig {
  url: string
  socket_session_id: string
  lang?: string
}

/** Shiro 旧 socket.io 上行指令 → v14 信封事件 */
export const emitEventMap: Record<string, string> = {
  join: 'room.join',
  leave: 'room.leave',
  updateSid: 'session.update',
  updateLang: 'lang.update',
} as const

/** v14 下行事件名（visitor.online）→ Shiro 事件名（VISITOR_ONLINE） */
export const mapEventName = (event: string): string =>
  event.toUpperCase().replaceAll('.', '_')

/** 将网关 http(s) 地址转换为 ws(s) 地址 */
export const toWsScheme = (url: string): string => url.replace(/^http/, 'ws')

/** 拼接 /ws/web 连接地址（含 socket_session_id 与可选 lang query） */
export const buildWsUrl = (config: WorkerConfig): string => {
  const params = new URLSearchParams({
    socket_session_id: config.socket_session_id,
  })
  if (config.lang) params.set('lang', config.lang)
  return `${config.url}?${params.toString()}`
}

/**
 * 将 Shiro 旧上行消息（{ type, payload }）转换为 v14 信封。
 * 未知指令返回 null（不发送）。
 */
export const toEmitEnvelope = (message: {
  type: string
  payload: unknown
}): WsEnvelope | null => {
  const event = emitEventMap[message.type]
  if (!event) return null
  return { v: WS_PROTOCOL_VERSION, event, payload: message.payload }
}

/** 解析下行信封文本；非法 JSON 或缺 event 字段返回 null */
export const parseInboundEnvelope = (
  raw: string,
): { event: string; payload: unknown } | null => {
  try {
    const envelope = JSON.parse(raw)
    if (!envelope || typeof envelope.event !== 'string') return null
    return { event: envelope.event, payload: envelope.payload }
  } catch {
    return null
  }
}
