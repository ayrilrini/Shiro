import type { AggregateRoot } from '@mx-space/api-client'
import { simpleCamelcaseKeys } from '@mx-space/api-client'
import { $fetch } from 'ofetch'

import { defaultThemeConfig } from '~/app.default.theme-config'
import { appStaticConfig } from '~/app.static.config'
import { attachServerFetch } from '~/lib/attach-fetch'
import { deepMerge } from '~/lib/lodash'
import { getQueryClient } from '~/lib/query-client.server'
import { apiClient } from '~/lib/request'
import { unwrapV3Envelope } from '~/lib/request.shared'

const cacheTime = appStaticConfig.cache.enabled
  ? appStaticConfig.cache.ttl.aggregation
  : 1
export const fetchAggregationData = async () => {
  await attachServerFetch()
  const queryClient = getQueryClient()
  const fetcher = async () => {
    // v14 响应为 { data, meta? } 信封：先解包再当作聚合对象使用，
    // 否则 seo/url/user 全部 undefined（generateMetadata 读 url.webUrl 即崩）
    const res = await $fetch<{
      data: AggregateRoot & { theme: AppThemeConfig }
    }>(apiClient.aggregate.proxy.toString(true), {
      params: {
        theme: 'shiro',
      },
    }).then(simpleCamelcaseKeys)

    const data = unwrapV3Envelope<AggregateRoot & { theme: AppThemeConfig }>(
      res,
    )

    return {
      ...data,
      theme: data.theme
        ? deepMerge(defaultThemeConfig, data.theme)
        : defaultThemeConfig,
    }
  }

  return queryClient.fetchQuery({
    queryKey: ['aggregate', 'shiro'],
    queryFn: fetcher,
    staleTime: cacheTime,
    gcTime: cacheTime,
  })
}
