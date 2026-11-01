import { RequestError } from '@mx-space/api-client'
import type { FetchError } from 'ofetch'

/**
 * v14 后端统一将响应包裹为 `{ data, meta? }` 信封（ResponseInterceptor）。
 * 绕过 api-client 的裸 fetch 需手动解包；兼容无信封的旧形态/异常响应。
 */
export const unwrapV3Envelope = <T = any>(json: any): T => {
  if (
    json !== null &&
    typeof json === 'object' &&
    !Array.isArray(json) &&
    'data' in json
  ) {
    return json.data as T
  }
  return json as T
}

export const getErrorMessageFromRequestError = (error: RequestError) => {
  if (!(error instanceof RequestError)) return (error as Error).message
  const fetchError = error.raw as FetchError
  const messagesOrMessage = fetchError.response?._data?.message
  const bizMessage =
    typeof messagesOrMessage === 'string'
      ? messagesOrMessage
      : Array.isArray(messagesOrMessage)
        ? messagesOrMessage[0]
        : undefined

  return bizMessage || fetchError.message
}
