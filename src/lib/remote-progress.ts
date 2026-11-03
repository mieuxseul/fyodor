export interface RemoteProgressSnapshot {
  chapterId: string
  pageIndex: number
  /** Chapters the user has opened/left or explicitly marked read. */
  readChapterIds: string[]
  updatedAt: string
}

export interface ChapterSortRef {
  id: string
  sortIndex: number
}

function key(providerId: string, titleId: string): string {
  return `fyodor.remoteProgress.${providerId}:${titleId}`
}

function write(
  providerId: string,
  titleId: string,
  next: RemoteProgressSnapshot,
): RemoteProgressSnapshot {
  try {
    localStorage.setItem(key(providerId, titleId), JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
  return next
}

export function loadRemoteProgress(
  providerId: string,
  titleId: string,
): RemoteProgressSnapshot | null {
  try {
    const raw = localStorage.getItem(key(providerId, titleId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as RemoteProgressSnapshot
    const readChapterIds = Array.isArray(parsed.readChapterIds) ? parsed.readChapterIds : []
    if (!parsed?.chapterId && readChapterIds.length === 0) return null
    return {
      chapterId: parsed.chapterId ?? '',
      pageIndex: Math.max(0, Number(parsed.pageIndex) || 0),
      readChapterIds,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function saveRemoteProgress(
  providerId: string,
  titleId: string,
  input: {
    chapterId: string
    pageIndex?: number
    markReadChapterId?: string
    /** When false, only update cursor — do not add chapterId to the read set. */
    markCurrentRead?: boolean
  },
): RemoteProgressSnapshot {
  const prev = loadRemoteProgress(providerId, titleId)
  const read = new Set(prev?.readChapterIds ?? [])
  if (input.markReadChapterId) read.add(input.markReadChapterId)
  if (input.markCurrentRead !== false) read.add(input.chapterId)
  return write(providerId, titleId, {
    chapterId: input.chapterId,
    pageIndex: input.pageIndex ?? prev?.pageIndex ?? 0,
    readChapterIds: [...read],
    updatedAt: new Date().toISOString(),
  })
}

export function markChapterRead(
  providerId: string,
  titleId: string,
  chapterId: string,
): RemoteProgressSnapshot {
  const prev = loadRemoteProgress(providerId, titleId)
  const read = new Set(prev?.readChapterIds ?? [])
  read.add(chapterId)
  return write(providerId, titleId, {
    chapterId: prev?.chapterId || chapterId,
    pageIndex: prev?.pageIndex ?? 0,
    readChapterIds: [...read],
    updatedAt: new Date().toISOString(),
  })
}

export function markChapterUnread(
  providerId: string,
  titleId: string,
  chapterId: string,
): RemoteProgressSnapshot {
  const prev = loadRemoteProgress(providerId, titleId)
  const read = new Set(prev?.readChapterIds ?? [])
  read.delete(chapterId)
  return write(providerId, titleId, {
    chapterId: prev?.chapterId ?? '',
    pageIndex: prev?.pageIndex ?? 0,
    readChapterIds: [...read],
    updatedAt: new Date().toISOString(),
  })
}

export function markPreviousRead(
  providerId: string,
  titleId: string,
  upToChapterId: string,
  chapters: ChapterSortRef[],
): RemoteProgressSnapshot {
  const target = chapters.find((chapter) => chapter.id === upToChapterId)
  const prev = loadRemoteProgress(providerId, titleId)
  const read = new Set(prev?.readChapterIds ?? [])
  if (target) {
    for (const chapter of chapters) {
      if (chapter.sortIndex <= target.sortIndex) read.add(chapter.id)
    }
  } else {
    read.add(upToChapterId)
  }
  return write(providerId, titleId, {
    chapterId: prev?.chapterId || upToChapterId,
    pageIndex: prev?.pageIndex ?? 0,
    readChapterIds: [...read],
    updatedAt: new Date().toISOString(),
  })
}
