import type { SocialTitle, SocialTitleInput } from '@/lib/types'

export function socialHref(title: Pick<SocialTitle, 'kind' | 'localTitleId' | 'providerId' | 'providerTitleId'>): string | null {
  if (title.kind === 'local' && title.localTitleId) {
    return `/title/${title.localTitleId}`
  }
  if (title.kind === 'remote' && title.providerId && title.providerTitleId) {
    return `/remote/${title.providerId}/${encodeURIComponent(title.providerTitleId)}`
  }
  return null
}

export function localSocialInput(opts: {
  titleId: string
  primaryTitle: string
  coverPath?: string | null
  author?: string | null
  contentType?: string | null
}): SocialTitleInput {
  return {
    kind: 'local',
    localTitleId: opts.titleId,
    primaryTitle: opts.primaryTitle,
    coverPath: opts.coverPath ?? null,
    author: opts.author ?? null,
    contentType: opts.contentType ?? 'manga',
  }
}

export function remoteSocialInput(opts: {
  providerId: string
  providerTitleId: string
  primaryTitle: string
  coverPath?: string | null
  author?: string | null
  contentType?: string | null
}): SocialTitleInput {
  return {
    kind: 'remote',
    providerId: opts.providerId,
    providerTitleId: opts.providerTitleId,
    primaryTitle: opts.primaryTitle,
    coverPath: opts.coverPath ?? null,
    author: opts.author ?? null,
    contentType: opts.contentType ?? 'manga',
  }
}

export function formatActivityLabel(kind: string): string {
  switch (kind) {
    case 'rated':
      return 'Rated'
    case 'liked':
      return 'Liked'
    case 'unliked':
      return 'Unliked'
    case 'diary':
      return 'Logged'
    case 'favorite':
      return 'Favorited'
    case 'read':
      return 'Read'
    default:
      return kind
  }
}

export function formatHalfStars(rating: number | null | undefined): string {
  if (rating == null || Number.isNaN(rating)) return '—'
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return `${'★'.repeat(full)}${half ? '½' : ''}` || '—'
}
