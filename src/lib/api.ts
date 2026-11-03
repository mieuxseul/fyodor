import { convertFileSrc, invoke } from '@tauri-apps/api/core'

import type {
  AppPaths,
  Bookmark,
  ChapterPages,
  CreateBookmarkInput,
  HistoryItem,
  ImportResult,
  LibraryItem,
  LocalFile,
  ReaderSession,
  ReadingProgress,
  SaveProgressInput,
  TitleDetails,
  UpdateTitleInput,
} from './types'

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function toAssetUrl(path?: string | null): string | undefined {
  if (!path) return undefined
  if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }
  try {
    return convertFileSrc(path)
  } catch {
    return path
  }
}

export const api = {
  getSettings(): Promise<Record<string, string>> {
    return invoke('get_settings')
  },
  getSetting(key: string): Promise<string | null> {
    return invoke('get_setting', { key })
  },
  setSetting(key: string, value: string): Promise<void> {
    return invoke('set_setting', { key, value })
  },
  getAppPaths(): Promise<AppPaths> {
    return invoke('get_app_paths')
  },
  backupDatabase(destination: string): Promise<string> {
    return invoke('backup_database', { destination })
  },
  listLibrary(options?: {
    status?: string
    query?: string
    sort?: string
    localOnly?: boolean
  }): Promise<LibraryItem[]> {
    return invoke('list_library', {
      status: options?.status ?? null,
      query: options?.query ?? null,
      sort: options?.sort ?? 'recent',
      localOnly: options?.localOnly ?? false,
    })
  },
  searchLibrary(query: string): Promise<LibraryItem[]> {
    return invoke('search_library', { query })
  },
  getTitleDetails(titleId: string): Promise<TitleDetails> {
    return invoke('get_title_details', { titleId })
  },
  updateTitle(input: UpdateTitleInput): Promise<void> {
    return invoke('update_title', { input })
  },
  removeFromLibrary(titleId: string): Promise<void> {
    return invoke('remove_from_library', { titleId })
  },
  getRemoteLibraryRef(
    providerId: string,
    providerTitleId: string,
  ): Promise<RemoteLibraryRef> {
    return invoke('get_remote_library_ref', { providerId, providerTitleId })
  },
  addRemoteToLibrary(input: AddRemoteLibraryInput): Promise<RemoteLibraryRef> {
    return invoke('add_remote_to_library', { input })
  },
  syncTitleCover(titleId: string): Promise<string | null> {
    return invoke('sync_title_cover', { titleId })
  },
  pickAndImportArchives(): Promise<ImportResult[]> {
    return invoke('pick_and_import_archives')
  },
  pickAndImportFolder(): Promise<ImportResult> {
    return invoke('pick_and_import_folder')
  },
  importPath(path: string): Promise<ImportResult> {
    return invoke('import_path', { path })
  },
  openEditionForReading(editionId: string): Promise<ReaderSession> {
    return invoke('open_edition_for_reading', { editionId })
  },
  getChapterPages(chapterId: string): Promise<ChapterPages> {
    return invoke('get_chapter_pages', { chapterId })
  },
  getReadingProgress(editionId: string): Promise<ReadingProgress | null> {
    return invoke('get_reading_progress', { editionId })
  },
  saveReadingProgress(input: SaveProgressInput): Promise<ReadingProgress> {
    return invoke('save_reading_progress', { input })
  },
  listHistory(limit = 100): Promise<HistoryItem[]> {
    return invoke('list_history', { limit })
  },
  clearHistory(): Promise<void> {
    return invoke('clear_history')
  },
  listBookmarks(): Promise<Bookmark[]> {
    return invoke('list_bookmarks')
  },
  createBookmark(input: CreateBookmarkInput): Promise<Bookmark> {
    return invoke('create_bookmark', { input })
  },
  deleteBookmark(id: string): Promise<void> {
    return invoke('delete_bookmark', { id })
  },
  relinkLocalFile(localFileId: string): Promise<LocalFile> {
    return invoke('relink_local_file', { localFileId })
  },
  mangadexCoverDataUrl(coverUrl: string): Promise<string> {
    return invoke('mangadex_cover_data_url', { coverUrl })
  },
  mangadexTitleDetails(mangaId: string): Promise<RemoteTitleDetails> {
    return invoke('mangadex_title_details', { mangaId })
  },
  mangadexChapters(mangaId: string): Promise<RemoteChapter[]> {
    return invoke('mangadex_chapters', { mangaId })
  },
  mangadexChapterPages(mangaId: string, chapterId: string): Promise<AtsuChapterPages> {
    return invoke('mangadex_chapter_pages', { mangaId, chapterId })
  },
  atsuCoverDataUrl(coverUrl: string): Promise<string> {
    return invoke('atsu_cover_data_url', { coverUrl })
  },
  atsuImageDataUrl(imageUrl: string): Promise<string> {
    return invoke('atsu_image_data_url', { imageUrl })
  },
  atsuTitleDetails(mangaId: string): Promise<RemoteTitleDetails> {
    return invoke('atsu_title_details', { mangaId })
  },
  atsuTitleBundle(mangaId: string): Promise<AtsuTitleBundle> {
    return invoke('atsu_title_bundle', { mangaId })
  },
  atsuChapters(mangaId: string): Promise<RemoteChapter[]> {
    return invoke('atsu_chapters', { mangaId })
  },
  atsuChapterPages(mangaId: string, chapterId: string): Promise<AtsuChapterPages> {
    return invoke('atsu_chapter_pages', { mangaId, chapterId })
  },
  kotatsuListSources(): Promise<
    Array<{
      name: string
      title: string
      locale: string
      contentType: string
      broken: boolean
      domain?: string | null
    }>
  > {
    return invoke('kotatsu_list_sources')
  },
  kotatsuSearch(source: string, query: string, limit = 12) {
    return invoke('kotatsu_search', { source, query, limit })
  },
  kotatsuTitleDetails(source: string, url: string, title?: string) {
    return invoke<Record<string, unknown>>('kotatsu_title_details', { source, url, title })
  },
  kotatsuChapters(source: string, url: string, title?: string) {
    return invoke<
      Array<{
        id: string
        url: string
        title: string
        number?: number | null
        scanlator?: string | null
        branch?: string | null
        sortIndex: number
      }>
    >('kotatsu_chapters', { source, url, title })
  },
  kotatsuChapterPages(source: string, chapterUrl: string, chapterId?: string) {
    return invoke<{ source: string; chapterUrl: string; pages: string[] }>(
      'kotatsu_chapter_pages',
      { source, chapterUrl, chapterId },
    )
  },
  openExternalUrl(url: string): Promise<void> {
    return invoke('open_external_url', { url })
  },
  checkForUpdates(): Promise<{
    currentVersion: string
    latestVersion?: string | null
    updateAvailable: boolean
    releaseUrl: string
    downloadUrl?: string | null
    notes?: string | null
  }> {
    return invoke('check_for_updates')
  },
}

/** Shared shape for in-app remote title details (Atsumaru / MangaDex). */
export type RemoteTitleDetails = AtsuTitleDetails
export type RemoteChapter = AtsuChapter & { websiteUrl?: string }

export interface AtsuTitleDetails {
  id: string
  title: string
  alternateTitles: string[]
  description?: string | null
  coverUrl?: string | null
  contentType: string
  publicationStatus?: string | null
  genres: string[]
  tags: string[]
  author?: string | null
  artist?: string | null
  websiteUrl: string
  isAdult: boolean
  chapterCount: number
  rating?: number | null
  releaseYear?: number | null
  latestChapterTitle?: string | null
  providerId: string
  providerName: string
}

export interface AtsuChapter {
  id: string
  mangaId: string
  title: string
  number?: number | null
  pageCount: number
  scanlator?: string | null
  sortIndex: number
  createdAt?: string | null
}

export interface RemoteLibraryRef {
  titleId: string
  editionId: string
  providerId: string
  providerTitleId: string
  inLibrary: boolean
}

export interface AddRemoteLibraryInput {
  providerId: string
  providerName: string
  providerTitleId: string
  primaryTitle: string
  alternateTitles: string[]
  description?: string | null
  author?: string | null
  artist?: string | null
  genres: string[]
  tags: string[]
  contentType: string
  publicationStatus?: string | null
  coverUrl?: string | null
  websiteUrl?: string | null
  readingDirection?: string | null
  readingMode?: string | null
}

export interface AtsuChapterPages {
  mangaId: string
  chapterId: string
  title: string
  pages: string[]
}

export interface AtsuTitleBundle {
  details: RemoteTitleDetails
  chapters: RemoteChapter[]
}

function isAtsuCdnUrl(path: string): boolean {
  return (
    path.startsWith('https://cdn.atsu.moe/static/') ||
    path.startsWith('http://cdn.atsu.moe/static/')
  )
}

function isMangaDexCoverUrl(path: string): boolean {
  return (
    path.startsWith('https://uploads.mangadex.org/covers/') ||
    path.startsWith('http://uploads.mangadex.org/covers/')
  )
}

/**
 * Map remote CDN URLs onto the local `fyodor-cdn` protocol.
 * Windows WebView: http://fyodor-cdn.localhost/...
 * Avoids base64 IPC for every cover/page image.
 */
export function toFyodorCdnUrl(path: string): string | undefined {
  try {
    const url = new URL(path)
    if (url.hostname === 'cdn.atsu.moe' && url.pathname.startsWith('/static/')) {
      return `http://fyodor-cdn.localhost/atsu${url.pathname}${url.search}`
    }
    if (url.hostname === 'uploads.mangadex.org' && url.pathname.startsWith('/covers/')) {
      return `http://fyodor-cdn.localhost/mangadex${url.pathname}${url.search}`
    }
  } catch {
    return undefined
  }
  return undefined
}

/** Resolve covers / page images for the webview. */
export async function resolveCoverUrl(path?: string | null): Promise<string | undefined> {
  if (!path) return undefined
  if (isAtsuCdnUrl(path) || isMangaDexCoverUrl(path)) {
    if (!isTauri()) return undefined
    return toFyodorCdnUrl(path)
  }
  return toAssetUrl(path)
}

/** Same as resolveCoverUrl — used by the reader for remote page images. */
export async function resolveRemoteImageUrl(
  path?: string | null,
): Promise<string | undefined> {
  return resolveCoverUrl(path)
}
