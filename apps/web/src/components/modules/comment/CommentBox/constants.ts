import { sample } from '~/lib/lodash'

export const getRandomPlaceholder = (t: (key: string) => string): string => {
  const candidates = t('comment_placeholders').split('|')
  return sample(candidates) || candidates[0]
}

export const MAX_COMMENT_TEXT_LENGTH = 500
