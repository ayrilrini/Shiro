'use client'

import './index.css'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'

import { clsxm } from '~/lib/helper'

export type LoadingProps = {
  loadingText?: string
  useDefaultLoadingText?: boolean
}

/**
 * 星星参数用黄金角确定性分布（无随机数），保证 SSR 与客户端 hydration 一致。
 */
const STAR_COLORS = [
  '#ffffff',
  '#bcd4ff',
  '#fff3c4',
  '#ffd9e8',
  '#c9f0ff',
] as const

function buildStars(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const goldenAngle = 137.508
    const angle = (i * goldenAngle) % 360
    const size = 2 + (i % 3)
    return {
      angle,
      size,
      delay: (i % 7) * 0.28,
      duration: 1.4 + (i % 5) * 0.28,
      distance: 42 + ((i * 29) % 40),
      color: STAR_COLORS[i % STAR_COLORS.length] as string,
      opacity: 0.55 + ((i * 13) % 45) / 100,
    }
  })
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

  const stars = useMemo(() => buildStars(28), [])

  return (
    <div
      data-hide-print
      className={clsxm(
        'space-loading-scene my-20 flex flex-col center rounded-3xl',
        'min-h-[46vmin]',
        className,
      )}
    >
      {/* warp 星空 */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        {stars.map((star, i) => (
          <span
            key={i}
            className="space-warp-star"
            style={
              {
                '--star-angle': `${star.angle}deg`,
                '--star-size': `${star.size}px`,
                '--star-delay': `${star.delay}s`,
                '--star-duration': `${star.duration}s`,
                '--star-distance': `${star.distance}vmin`,
                '--star-color': star.color,
                '--star-opacity': star.opacity,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* 宇宙飞船 */}
      <div className="space-ship-group" aria-hidden>
        <div className="relative">
          <div className="space-ship-trail-glow" />
          <div className="space-ship-trail" />
          <span className="space-ship-body">🚀</span>
        </div>
      </div>

      {!!nextLoadingText && (
        <span className="relative z-10 mt-8 block text-sm text-white/70">
          {nextLoadingText}
        </span>
      )}
    </div>
  )
}

export const FullPageLoading = () => (
  <Loading useDefaultLoadingText className="h-[calc(100vh-6.5rem-10rem)]" />
)
