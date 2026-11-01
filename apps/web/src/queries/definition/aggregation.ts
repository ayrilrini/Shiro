import type { AggregateRoot, PageModel } from '@mx-space/api-client'
import { isServer } from '@tanstack/react-query'

import { apiClient } from '~/lib/request'

import { defineQuery } from '../helper'

export type PageMetaItem = Pick<PageModel, 'id' | 'title' | 'slug'>

export const aggregation = {
  root: () =>
    defineQuery({
      queryKey: ['aggregation'],
      queryFn: async () => {
        // v14 聚合端点不再附带 pageMeta（页面列表），单独拉取后合并
        const [aggRes, pagesRes] = await Promise.all([
          apiClient.aggregate.getAggregateData('shiro'),
          apiClient.page.getList(1, 100).catch(() => null),
        ])
        const agg = aggRes.$serialized as AggregateRoot & {
          theme: AppThemeConfig
        }
        const pageMeta: PageMetaItem[] =
          pagesRes?.$serialized.data.map(({ id, title, slug }) => ({
            id,
            title,
            slug,
          })) ?? []
        return { ...agg, pageMeta }
      },
      gcTime: 1000 * 60 * 10,
      staleTime: isServer ? 1000 * 60 * 10 : undefined,
    }),
}
