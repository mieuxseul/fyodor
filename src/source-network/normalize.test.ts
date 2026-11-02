import { describe, expect, it } from 'vitest'

import { groupSearchResults, normalizeTitleKey } from './normalize'
import type { NormalizedSearchResult } from './types'

function result(
  partial: Partial<NormalizedSearchResult> &
    Pick<NormalizedSearchResult, 'providerId' | 'providerTitleId' | 'title'>,
): NormalizedSearchResult {
  return {
    providerName: partial.providerId,
    alternateTitles: [],
    genres: [],
    contentType: 'manga',
    isMock: false,
    ...partial,
  }
}

describe('normalizeTitleKey', () => {
  it('strips punctuation and case', () => {
    expect(normalizeTitleKey('Glass-Garden!!!')).toBe('glass garden')
  })
})

describe('groupSearchResults', () => {
  it('groups exact title matches across providers as editions', () => {
    const groups = groupSearchResults([
      result({
        providerId: 'local-library',
        providerTitleId: '1',
        title: 'Glass Garden',
      }),
      result({
        providerId: 'mock-catalog',
        providerTitleId: 'mock-1',
        title: 'Glass Garden',
        isMock: true,
        chapterCount: 12,
      }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].editions).toHaveLength(2)
    expect(groups[0].confidence).toBe('likely')
    expect(groups[0].isMock).toBe(true)
  })

  it('keeps unrelated titles separate', () => {
    const groups = groupSearchResults([
      result({
        providerId: 'local-library',
        providerTitleId: '1',
        title: 'Glass Garden',
      }),
      result({
        providerId: 'mock-catalog',
        providerTitleId: 'mock-2',
        title: 'Oxblood Archive',
        isMock: true,
      }),
    ])

    expect(groups).toHaveLength(2)
  })

  it('carries MangaDex websiteUrl onto editions', () => {
    const groups = groupSearchResults([
      result({
        providerId: 'mangadex',
        providerTitleId: 'abc',
        title: 'Example',
        raw: { websiteUrl: 'https://mangadex.org/title/abc' },
      }),
    ])

    expect(groups[0].editions[0].websiteUrl).toBe('https://mangadex.org/title/abc')
  })
})
