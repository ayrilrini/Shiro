'use client'

import type { PostModel } from '@mx-space/api-client'
import { createModelDataProvider } from 'jojoo/react'

import { isClientSide, isDev } from '~/lib/env'

type PostWithTranslation = PostModel

const {
  ModelDataProvider,
  ModelDataAtomProvider,
  getGlobalModelData,
  setGlobalModelData,
  useSetModelData,
  useModelDataSelector,
} = createModelDataProvider<PostWithTranslation>()

declare global {
  interface Window {
    getModelPostData: typeof getGlobalModelData
  }
}
if (isDev && isClientSide) window.getModelPostData = getGlobalModelData

export {
  ModelDataAtomProvider as CurrentPostDataAtomProvider,
  ModelDataProvider as CurrentPostDataProvider,
  getGlobalModelData as getGlobalCurrentPostData,
  setGlobalModelData as setGlobalCurrentPostData,
  useModelDataSelector as useCurrentPostDataSelector,
  useSetModelData as useSetCurrentPostData,
}
