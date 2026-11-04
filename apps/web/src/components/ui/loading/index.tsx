'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { clsxm } from '~/lib/helper'

export type LoadingProps = {
  loadingText?: string
  useDefaultLoadingText?: boolean
}

export const Loading: Component<LoadingProps> = ({
  loadingText,
  className,
  useDefaultLoadingText = false,
}) => {
  const t = useTranslations('common')
  const candidates = t('loading_default').split('|')
  // SSR 固定渲染第一条，客户端挂载后再随机，避免 hydration mismatch
  const [index, setIndex] = useState(0)
  useEffect(() => {
    setIndex(Math.floor(Math.random() * candidates.length))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const defaultLoadingText = candidates[index] || candidates[0]
  const nextLoadingText = useDefaultLoadingText
    ? defaultLoadingText
    : loadingText
  return (
    <div
      data-hide-print
      className={clsxm('my-20 flex flex-col center', className)}
    >
      <span className="loading loading-ball loading-lg" />
      {!!nextLoadingText && (
        <span className="mt-6 block">{nextLoadingText}</span>
      )}
    </div>
  )
}

export const FullPageLoading = () => (
  <Loading useDefaultLoadingText className="h-[calc(100vh-6.5rem-10rem)]" />
)
