import type {
  GroupedSearchResult,
  NormalizedSearchResult,
  SearchEdition,
} from './types'

export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ')
}

export function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titlesOverlap(a: NormalizedSearchResult, b: NormalizedSearchResult): boolean {
  const aKeys = new Set(
    [a.title, ...a.alternateTitles].map(normalizeTitleKey).filter(Boolean),
  )
  const bKeys = [b.title, ...b.alternateTitles].map(normalizeTitleKey).filter(Boolean)
  return bKeys.some((key) => aKeys.has(key))
}

function toEdition(result: NormalizedSearchResult, capabilities: SearchEdition['capabilities']): SearchEdition {
  const websiteUrl =
    result.raw &&
    typeof result.raw === 'object' &&
    result.raw !== null &&
    'websiteUrl' in result.raw &&
    typeof (result.raw as { websiteUrl?: unknown }).websiteUrl === 'string'
      ? (result.raw as { websiteUrl: string }).websiteUrl
      : undefined

  return {
    providerId: result.providerId,
    providerName: result.providerName,
    providerTitleId: result.providerTitleId,
    language: result.language,
    chapterCount: result.chapterCount,
    capabilities,
    isMock: result.isMock,
    websiteUrl,
  }
}

/**
 * Conservative grouping: only merge when normalized titles match exactly.
 * Different languages / providers become editions, not silent merges of uncertain matches.
 */
export function groupSearchResults(
  results: NormalizedSearchResult[],
  capabilityLookup: Record<string, SearchEdition['capabilities']> = {},
): GroupedSearchResult[] {
  const groups: GroupedSearchResult[] = []

  for (const result of results) {
    const existing = groups.find(
      (group) =>
        normalizeTitleKey(group.primaryTitle) === normalizeTitleKey(result.title) ||
        group.alternateTitles.some(
          (alt) => normalizeTitleKey(alt) === normalizeTitleKey(result.title),
        ) ||
        result.alternateTitles.some(
          (alt) => normalizeTitleKey(alt) === normalizeTitleKey(group.primaryTitle),
        ) ||
        titlesOverlap(
          {
            ...result,
            title: group.primaryTitle,
            alternateTitles: group.alternateTitles,
          },
          result,
        ),
    )

    const caps =
      capabilityLookup[result.providerId] ?? {
        search: true,
        metadata: true,
        chapterList: false,
        onlineReading: false,
        downloads: false,
      }

    if (!existing) {
      groups.push({
        groupId: `${normalizeTitleKey(result.title) || 'untitled'}::${result.providerId}::${result.providerTitleId}`,
        primaryTitle: result.title,
        alternateTitles: [...result.alternateTitles],
        description: result.description,
        coverUrl: result.coverUrl,
        contentType: result.contentType,
        publicationStatus: result.publicationStatus,
        genres: [...result.genres],
        latestChapterLabel:
          result.chapterCount != null ? `${result.chapterCount} chapters` : undefined,
        editions: [toEdition(result, caps)],
        confidence: 'exact',
        isMock: result.isMock,
      })
      continue
    }

    const alreadyHasEdition = existing.editions.some(
      (edition) =>
        edition.providerId === result.providerId &&
        edition.providerTitleId === result.providerTitleId,
    )
    if (!alreadyHasEdition) {
      existing.editions.push(toEdition(result, caps))
    }

    for (const alt of result.alternateTitles) {
      if (!existing.alternateTitles.includes(alt) && alt !== existing.primaryTitle) {
        existing.alternateTitles.push(alt)
      }
    }
    if (!existing.description && result.description) {
      existing.description = result.description
    }
    if (!existing.coverUrl && result.coverUrl) {
      existing.coverUrl = result.coverUrl
    }
    if (!existing.publicationStatus && result.publicationStatus) {
      existing.publicationStatus = result.publicationStatus
    }
    if (!existing.latestChapterLabel && result.chapterCount != null) {
      existing.latestChapterLabel = `${result.chapterCount} chapters`
    }
    for (const genre of result.genres) {
      if (!existing.genres.includes(genre)) existing.genres.push(genre)
    }
    existing.isMock = existing.isMock || result.isMock
    if (existing.editions.length > 1) {
      existing.confidence = 'likely'
    }
  }

  return groups.sort((a, b) => a.primaryTitle.localeCompare(b.primaryTitle))
}
