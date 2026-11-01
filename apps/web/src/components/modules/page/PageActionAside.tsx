'use client'

import { useCurrentPageDataSelector } from '~/providers/page/CurrentPageDataProvider'

import { ActionAsideContainer } from '../shared/ActionAsideContainer'
import { AsideCommentButton } from '../shared/AsideCommentButton'
import { AsideDonateButton } from '../shared/AsideDonateButton'

export const PageActionAside: Component = ({ className }) => (
  <ActionAsideContainer className={className}>
    <PageAsideCommentButton />
    <AsideDonateButton />
  </ActionAsideContainer>
)

const PageAsideCommentButton = () => {
  const { title, id } =
    useCurrentPageDataSelector((data) => ({
      title: data?.title,
      id: data?.id,
    })) || {}
  // v14 页面模型不再含 allowComment，默认开放
  if (!id) return null
  return <AsideCommentButton refId={id} title={title!} />
}
