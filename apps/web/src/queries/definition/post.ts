import type { PostModel, PostResponseMeta } from '@mx-space/api-client'

import { apiClient } from '~/lib/request'

import { defineQuery } from '../helper'

export type PostWithTranslation = PostModel

export interface PostDetailQueryResult {
  post: PostWithTranslation
  /**
   * v14 响应 meta 中的翻译元数据：`Record<entryId, EntryTranslation>`（详情接口），
   * 见 mx-core `post.controller.ts` 的 `metaBuilder.translation(translationMap)`。
   */
  translation?: PostResponseMeta['translation']
}

export const post = {
  bySlug: (category: string, slug: string, lang?: string) =>
    defineQuery({
      queryKey: ['post', category, slug, lang],

      queryFn: async ({ queryKey }) => {
        const [, category, slug, lang] = queryKey as [
          string,
          string,
          string,
          string | undefined,
        ]

        const data = await apiClient.post.getPost(category, slug, {
          lang: lang || undefined,
          prefer: 'lexical',
        })

        return {
          post: data.$serialized as PostWithTranslation,
          translation: data.$meta?.translation,
        } satisfies PostDetailQueryResult
      },
    }),
}
