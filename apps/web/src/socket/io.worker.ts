/// <reference lib="webworker" />

/**
 * mx-core v14 原生 WebSocket 客户端（替代原 socket.io 实现）。
 * 协议纯函数见 ./protocol.ts；心跳由 WS 协议层 ping/pong 完成，无需实现。
 */

import type { WorkerConfig } from './protocol'
import {
  buildWsUrl,
  mapEventName,
  parseInboundEnvelope,
  toEmitEnvelope,
} from './protocol'

let ws: WebSocket | null = null
let currentConfig: WorkerConfig | null = null
let reconnectAttempts = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let manualClose = false

const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_DELAY_MS = 3000

function flushWaitingQueue() {
  if (waitingEmitQueue.length === 0) return
  waitingEmitQueue.forEach((payload) => sendEnvelope(payload))
  waitingEmitQueue.length = 0
}

function sendEnvelope(message: { type: string; payload: any }) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false
  const envelope = toEmitEnvelope(message)
  if (!envelope) return false
  ws.send(JSON.stringify(envelope))
  return true
}

function scheduleReconnect() {
  if (manualClose) return
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return
  reconnectAttempts += 1
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(() => {
    if (currentConfig) setupIo(currentConfig)
  }, RECONNECT_DELAY_MS)
}

function setupIo(config: WorkerConfig) {
  if (ws && ws.readyState !== WebSocket.CLOSED) return
  currentConfig = config

  const url = buildWsUrl(config)
  console.info('Connecting to ws, url:', url)

  manualClose = false
  ws = new WebSocket(url)

  ws.onopen = () => {
    console.info('Connected to ws server from worker')
    reconnectAttempts = 0
    flushWaitingQueue()
    boardcast({
      type: 'connect',
      payload: config.socket_session_id,
    })
  }

  ws.onclose = () => {
    boardcast({
      type: 'disconnect',
    })
    scheduleReconnect()
  }

  ws.onerror = (err) => {
    console.warn('[ws] error', err)
  }

  ws.onmessage = (event) => {
    const envelope = parseInboundEnvelope(event.data)
    if (!envelope) return

    boardcast({
      type: 'message',
      payload: {
        type: mapEventName(envelope.event),
        data: envelope.payload,
      },
    })
  }

  boardcast({
    type: 'sid',
    payload: config.socket_session_id,
  })
}

function closeSocket() {
  manualClose = true
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (ws) {
    const socket = ws
    ws = null
    try {
      socket.close()
    } catch {
      // ignore
    }
  }
}

const ports = [] as MessagePort[]

const preparePort = (port: MessagePort | Window) => {
  port.onmessage = (event) => {
    const { type, payload } = event.data

    switch (type) {
      case 'config': {
        setupIo(payload)
        break
      }
      case 'emit': {
        if (!sendEnvelope(payload)) {
          waitingEmitQueue.push(payload)
        }
        break
      }
      case 'reconnect': {
        reconnectAttempts = 0
        closeSocket()
        manualClose = false
        if (currentConfig) setupIo(currentConfig)
        break
      }
      case 'init': {
        port.postMessage({ type: 'ping' })

        if (ws) {
          if (ws.readyState === WebSocket.OPEN)
            port.postMessage({ type: 'connect' })
          port.postMessage({
            type: 'sid',
            payload: currentConfig?.socket_session_id,
          })
        }
        break
      }
      default: {
        console.info('Unknown message type:', type)
      }
    }
  }
}

self.addEventListener('connect', (ev: any) => {
  const event = ev as MessageEvent

  const port = event.ports[0]

  ports.push(port)
  preparePort(port)
  port.start()
})

if (!('SharedWorkerGlobalScope' in self)) {
  ports.push(self as any as MessagePort)
  preparePort(self)
}

function boardcast(payload: any) {
  ports.forEach((port) => {
    port.postMessage(payload)
  })
}

const waitingEmitQueue: any[] = []
