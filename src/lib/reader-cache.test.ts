import { describe, expect, it } from 'vitest'

import {
  chapterCacheKey,
  formatReaderError,
  getCachedChapterPages,
  setCachedChapterPages,
} from './reader-cache'

describe('reader-cache', () => {
  it('stores and returns chapter pages', () => {
    const key = chapterCacheKey('mangadex', 'abc', 'ch1')
    setCachedChapterPages(key, ['a', 'b'])
    expect(getCachedChapterPages(key)).toEqual(['a', 'b'])
  })

  it('formats rate-limit errors', () => {
    const result = formatReaderError(new Error('MangaDex rate limited (HTTP 429)'))
    expect(result.rateLimited).toBe(true)
    expect(result.message.toLowerCase()).toContain('rate-limiting')
  })
})
