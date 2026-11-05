import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearReadingHistory,
  historyResumePath,
  historyTitlePath,
  listReadingHistory,
  recordReadingOpen,
} from '@/lib/reading-history'

describe('reading-history', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('records and lists opens newest-first', () => {
    recordReadingOpen({
      titleId: 't1',
      editionId: 'e1',
      primaryTitle: 'Alpha',
      openedAt: '2026-01-01T00:00:00.000Z',
    })
    recordReadingOpen({
      titleId: 't2',
      editionId: 'e2',
      primaryTitle: 'Beta',
      providerId: 'kotatsu',
      providerTitleId: 'src/42',
      openedAt: '2026-01-02T00:00:00.000Z',
    })
    const items = listReadingHistory()
    expect(items.map((item) => item.primaryTitle)).toEqual(['Beta', 'Alpha'])
  })

  it('dedupes by remote key and keeps newest', () => {
    recordReadingOpen({
      titleId: 't',
      editionId: 'kotatsu:src/1',
      primaryTitle: 'Old',
      providerId: 'kotatsu',
      providerTitleId: 'src/1',
      openedAt: '2026-01-01T00:00:00.000Z',
    })
    recordReadingOpen({
      titleId: 't',
      editionId: 'kotatsu:src/1',
      primaryTitle: 'New',
      chapterTitle: 'Ch 2',
      providerId: 'kotatsu',
      providerTitleId: 'src/1',
      openedAt: '2026-01-03T00:00:00.000Z',
    })
    const items = listReadingHistory()
    expect(items).toHaveLength(1)
    expect(items[0]?.primaryTitle).toBe('New')
    expect(items[0]?.chapterTitle).toBe('Ch 2')
  })

  it('builds resume and title paths for remotes', () => {
    const entry = recordReadingOpen({
      titleId: 'kotatsu:src/9',
      editionId: 'kotatsu:src/9',
      primaryTitle: 'Remote',
      chapterId: 'ch-9',
      providerId: 'kotatsu',
      providerTitleId: 'src/9',
    })
    expect(historyResumePath(entry)).toBe(
      '/reader/kotatsu:src/9?chapter=ch-9',
    )
    expect(historyTitlePath(entry)).toBe('/remote/kotatsu/src%2F9')
  })

  it('clears history', () => {
    recordReadingOpen({
      titleId: 't',
      editionId: 'e',
      primaryTitle: 'X',
    })
    clearReadingHistory()
    expect(listReadingHistory()).toEqual([])
  })
})