import type { NoteResponseMeta, NoteWrappedPayload } from '@mx-space/api-client'

import { apiClient } from '~/lib/request'

import { defineQuery } from '../helper'

export interface NoteDetailQueryResult {
  note: NoteWrappedPayload
  /**
   * v14 响应 meta 中的翻译元数据：`Record<entryId, EntryTranslation>`（详情接口），
   * 见 mx-core `note.controller.ts` 的 `metaBuilder.translation(translationMap)`。
   */
  translation?: NoteResponseMeta['translation']
}

const LATEST_KEY = 'latest'
export const note = {
  byNid: (nid: string, password?: string | null, lang?: string) =>
    defineQuery({
      queryKey: ['note', nid, lang],

      queryFn: async ({ queryKey }) => {
        const [, id, lang] = queryKey as [string, string, string | undefined]

        if (id === LATEST_KEY) {
          return {
            note: (await apiClient.note.getLatest()).$serialized,
          } satisfies NoteDetailQueryResult
        }
        const data = await apiClient.note.getNoteByNid(Number(id), {
          password: password || undefined,
          lang: lang || undefined,
          prefer: 'lexical',
        })

        return {
          note: data.$serialized as NoteWrappedPayload,
          translation: data.$meta?.translation,
        } satisfies NoteDetailQueryResult
      },
    }),
}
