import type { ChapterSortRef } from '@/lib/remote-progress'

export interface LocalReadSnapshot {
  readChapterIds: string[]
  updatedAt: string
}

function key(editionId: string): string {
  return `fyodor.localReadChapters.${editionId}`
}

function write(editionId: string, next: LocalReadSnapshot): LocalReadSnapshot {
  try {
    localStorage.setItem(key(editionId), JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
  return next
}

export function loadLocalReadChapters(editionId: string): LocalReadSnapshot {
  try {
    const raw = localStorage.getItem(key(editionId))
    if (!raw) return { readChapterIds: [], updatedAt: new Date().toISOString() }
    const parsed = JSON.parse(raw) as LocalReadSnapshot
    return {
      readChapterIds: Array.isArray(parsed.readChapterIds) ? parsed.readChapterIds : [],
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    }
  } catch {
    return { readChapterIds: [], updatedAt: new Date().toISOString() }
  }
}

export function markLocalChapterRead(editionId: string, chapterId: string): LocalReadSnapshot {
  const prev = loadLocalReadChapters(editionId)
  const read = new Set(prev.readChapterIds)
  read.add(chapterId)
  return write(editionId, {
    readChapterIds: [...read],
    updatedAt: new Date().toISOString(),
  })
}

export function markLocalChapterUnread(editionId: string, chapterId: string): LocalReadSnapshot {
  const prev = loadLocalReadChapters(editionId)
  const read = new Set(prev.readChapterIds)
  read.delete(chapterId)
  return write(editionId, {
    readChapterIds: [...read],
    updatedAt: new Date().toISOString(),
  })
}

export function markLocalPreviousRead(
  editionId: string,
  upToChapterId: string,
  chapters: ChapterSortRef[],
): LocalReadSnapshot {
  const target = chapters.find((chapter) => chapter.id === upToChapterId)
  const prev = loadLocalReadChapters(editionId)
  const read = new Set(prev.readChapterIds)
  if (target) {
    for (const chapter of chapters) {
      if (chapter.sortIndex <= target.sortIndex) read.add(chapter.id)
    }
  } else {
    read.add(upToChapterId)
  }
  return write(editionId, {
    readChapterIds: [...read],
    updatedAt: new Date().toISOString(),
  })
}
