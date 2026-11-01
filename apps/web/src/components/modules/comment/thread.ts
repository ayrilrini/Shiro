import type {
  CommentAnchorModel,
  CommentModel,
  CommentRefSummary,
  CommentReplyWindow,
  CommentThreadItem,
  PaginateResult,
  ReaderModel,
} from '@mx-space/api-client'
import type { InfiniteData } from '@tanstack/react-query'

// v14 模型的 anchor 为 CommentAnchorModel | null（读取形态，字段全可选）、
// source 字段已移除。本地 BlockAnchor/RangeAnchor 仅在提交评论时构造。
export type CommentWithAnchor = Omit<CommentModel, 'anchor'> & {
  anchor?: CommentAnchorModel | null
  /** v14 已移除 source 字段，保留为可选以兼容历史缓存数据 */
  source?: string | null
  new?: boolean
}

export type CommentThreadViewItem = CommentWithAnchor & {
  children: CommentThreadViewItem[]
  replies?: CommentWithAnchor[]
  replyWindow?: CommentReplyWindow
}

export type CommentThreadPage = PaginateResult<
  Omit<CommentThreadItem, 'anchor' | 'ref'> & {
    anchor?: CommentAnchorModel | null
    ref?: CommentRefSummary | string | null
  }
>
export type CommentThreadInfiniteData = InfiniteData<
  CommentThreadPage & {
    readers?: Record<string, ReaderModel>
  }
>

const toTimestamp = (date: string) => new Date(date).getTime()

const byCreatedAsc = (
  a: Pick<CommentModel, 'createdAt'>,
  b: Pick<CommentModel, 'createdAt'>,
) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt)

const getParentCommentId = (
  parentCommentId: CommentModel['parentCommentId'],
) => {
  if (!parentCommentId) return null
  if (typeof parentCommentId === 'string') return parentCommentId
  return null
}

const createViewComment = (
  comment: CommentWithAnchor,
): CommentThreadViewItem => ({
  ...comment,
  children: [],
})

const sortChildrenDeep = (comment: CommentThreadViewItem) => {
  comment.children.sort(byCreatedAsc)
  for (const child of comment.children) {
    sortChildrenDeep(child)
  }
}

export const buildCommentTreeItem = (
  rootComment: CommentThreadPage['data'][number] | CommentThreadViewItem,
): CommentThreadViewItem => {
  const rootView = createViewComment(rootComment as CommentWithAnchor)
  const replyViews = (rootComment.replies ?? []).map((reply) =>
    createViewComment(reply as CommentWithAnchor),
  )

  const commentMap = new Map<string, CommentThreadViewItem>([
    [rootView.id, rootView],
    ...replyViews.map((reply) => [reply.id, reply] as const),
  ])

  for (const reply of replyViews.sort(byCreatedAsc)) {
    const parentId = getParentCommentId(reply.parentCommentId)
    const parent = (parentId && commentMap.get(parentId)) || rootView
    parent.children.push(reply)
  }

  sortChildrenDeep(rootView)

  return {
    ...rootView,
    replies: dedupeRepliesById(rootComment.replies ?? []),
    replyWindow: rootComment.replyWindow,
  }
}

export const flattenThreadComments = (
  comments: Array<CommentThreadPage['data'][number] | CommentThreadViewItem>,
): CommentWithAnchor[] => {
  const result: CommentWithAnchor[] = []
  for (const comment of comments) {
    result.push(comment as CommentWithAnchor)
    if (comment.replies) {
      result.push(...(comment.replies as CommentWithAnchor[]))
    }
  }
  return dedupeRepliesById(result)
}

export const dedupeRepliesById = <T extends Pick<CommentModel, 'id'>>(
  comments: readonly T[],
): T[] => {
  const seen = new Set<string>()
  const result: T[] = []
  for (const comment of comments) {
    if (seen.has(comment.id)) continue
    seen.add(comment.id)
    result.push(comment)
  }
  return result
}

export const mergeThreadRepliesIntoPages = (
  data: CommentThreadInfiniteData,
  {
    rootCommentId,
    replies,
    replyWindow,
  }: {
    rootCommentId: string
    replies: CommentWithAnchor[]
    replyWindow: CommentReplyWindow
  },
): CommentThreadInfiniteData => ({
  ...data,
  pages: data.pages.map((page) => ({
    ...page,
    data: page.data.map((comment) => {
      if (comment.id !== rootCommentId) return comment

      return {
        ...comment,
        replies: dedupeRepliesById([
          ...(comment.replies ?? []),
          ...replies,
        ]).sort(byCreatedAsc) as CommentModel[],
        replyWindow,
      }
    }),
  })),
})
