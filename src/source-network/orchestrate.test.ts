import { describe, expect, it } from 'vitest'

import { searchProviders } from './orchestrate'
import type { MangaProvider, NormalizedSearchResult } from './types'

function provider(
  id: string,
  searchImpl: MangaProvider['search'],
): MangaProvider {
  return {
    info: {
      id,
      name: id,
      version: '1.0.0',
      description: id,
      isMock: id.includes('mock'),
      capabilities: {
        search: true,
        metadata: true,
        chapterList: false,
        onlineReading: false,
        downloads: false,
      },
    },
    search: searchImpl,
  }
}

describe('searchProviders', () => {
  it('keeps successful results when another provider fails', async () => {
    const report = await searchProviders({
      query: 'garden',
      providers: [
        provider('ok', async () => [
          {
            providerTitleId: '1',
            providerId: 'ok',
            providerName: 'ok',
            title: 'Glass Garden',
            alternateTitles: [],
            genres: [],
            contentType: 'manga',
            isMock: false,
          } satisfies NormalizedSearchResult,
        ]),
        provider('bad', async () => {
          throw new Error('network down')
        }),
      ],
      timeoutMs: 1000,
    })

    expect(report.groups).toHaveLength(1)
    expect(report.outcomes.find((item) => item.providerId === 'ok')?.ok).toBe(true)
    expect(report.outcomes.find((item) => item.providerId === 'bad')?.ok).toBe(false)
  })

  it('supports cancellation', async () => {
    const controller = new AbortController()
    const pending = searchProviders({
      query: 'garden',
      signal: controller.signal,
      providers: [
        provider('slow', async (_query, options) => {
          await new Promise<void>((resolve, reject) => {
            const timer = window.setTimeout(() => resolve(), 500)
            options?.signal?.addEventListener(
              'abort',
              () => {
                window.clearTimeout(timer)
                reject(new DOMException('Search cancelled', 'AbortError'))
              },
              { once: true },
            )
          })
          return []
        }),
      ],
      timeoutMs: 2000,
    })
    controller.abort()
    const report = await pending
    expect(report.outcomes[0]?.cancelled || report.cancelled).toBe(true)
  })
})
