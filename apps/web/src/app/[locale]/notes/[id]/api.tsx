import type { NoteWrappedPayload } from '@mx-space/api-client'

import { attachServerFetch } from '~/lib/attach-fetch'
import { getQueryClient } from '~/lib/query-client.server'
import { requestErrorHandler } from '~/lib/request.server'
import { queries } from '~/queries/definition'
import type { NoteDetailQueryResult } from '~/queries/definition/note'

export interface NoteParams extends LocaleParams {
  id: string
  password?: string | string[] | null
  lang?: string
}

export interface NoteDataResult {
  note: NoteWrappedPayload
  translation?: NoteDetailQueryResult['translation']
}

const getNoteData = async (params: NoteParams, lang?: string) => {
  await attachServerFetch()

  const { id } = params
  const password = Array.isArray(params.password)
    ? params.password[0]
    : (params.password ?? undefined)

  const query = queries.note.byNid(id, password, lang)

  const data = await getQueryClient()
    .fetchQuery({
      ...query,
      staleTime: 0,
    })
    .catch(requestErrorHandler)
  return data as NoteDetailQueryResult
}

export const getData = async (params: NoteParams): Promise<NoteDataResult> => {
  // 如果指定了 lang=original，不传 lang 参数
  if (params.lang === 'original') {
    return getNoteData(params, 'original')
  }

  const preferredLang = params.lang || params.locale

  return getNoteData(params, preferredLang || undefined)
}
