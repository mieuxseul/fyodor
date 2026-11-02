export type ReadingStatus =
  | 'reading'
  | 'completed'
  | 'planned'
  | 'on_hold'
  | 'dropped'

export type ThemePreference = 'dark' | 'light' | 'system'
export type LibraryView = 'grid' | 'list'
export type ReadingMode = 'page' | 'vertical'
export type ReadingDirection = 'ltr' | 'rtl'
export type FitMode = 'width' | 'height' | 'screen' | 'original'

export interface Title {
  id: string
  primaryTitle: string
  alternateTitles: string[]
  description?: string | null
  author?: string | null
  artist?: string | null
  genres: string[]
  tags: string[]
  contentType: string
  originalLanguage?: string | null
  publicationStatus?: string | null
  coverPath?: string | null
  createdAt: string
  updatedAt: string
}

export interface Edition {
  id: string
  titleId: string
  label: string
  language?: string | null
  readingDirection: ReadingDirection | string
  readingMode: ReadingMode | string
  sourceKind: string
  providerId?: string | null
  providerTitleId?: string | null
  createdAt: string
  updatedAt: string
}

export interface Chapter {
  id: string
  editionId: string
  number?: number | null
  title: string
  sortIndex: number
  pageCount: number
  createdAt: string
}

export interface LocalFile {
  id: string
  editionId: string
  chapterId?: string | null
  kind: string
  sourcePath: string
  managedPath?: string | null
  pagePaths: string[]
  existsOnDisk: boolean
  createdAt: string
}

export interface LibraryEntry {
  id: string
  titleId: string
  status: ReadingStatus | string
  preferredEditionId?: string | null
  addedAt: string
  lastOpenedAt?: string | null
  isLocal: boolean
  isDownloaded: boolean
}

export interface ReadingProgress {
  id: string
  editionId: string
  chapterId?: string | null
  pageIndex: number
  scrollRatio: number
  completed: boolean
  updatedAt: string
}

export interface LibraryItem {
  title: Title
  entry: LibraryEntry
  preferredEdition?: Edition | null
  progress?: ReadingProgress | null
  chapterCount: number
  currentChapterTitle?: string | null
}

export interface TitleDetails {
  title: Title
  entry?: LibraryEntry | null
  editions: Edition[]
  chapters: Chapter[]
  progress?: ReadingProgress | null
  localFiles: LocalFile[]
}

export interface ImportResult {
  titleId: string
  editionId: string
  primaryTitle: string
  chapterCount: number
  pageCount: number
  warnings: string[]
}

export interface ChapterPages {
  chapter: Chapter
  pages: string[]
  sourcePath?: string | null
  kind: string
}

export interface ReaderSession {
  title: Title
  edition: Edition
  chapters: Chapter[]
  progress?: ReadingProgress | null
}

export interface AppPaths {
  dataDir: string
  databasePath: string
  coversDir: string
  cacheDir: string
}

export interface UpdateTitleInput {
  id: string
  primaryTitle?: string
  description?: string
  author?: string
  artist?: string
  contentType?: string
  status?: string
  readingDirection?: string
  readingMode?: string
}

export interface SaveProgressInput {
  editionId: string
  chapterId?: string | null
  pageIndex: number
  scrollRatio: number
  completed: boolean
}

export interface HistoryItem {
  id: string
  openedAt: string
  title: Title
  edition: Edition
  chapter?: Chapter | null
  progress?: ReadingProgress | null
}

export interface Bookmark {
  id: string
  titleId: string
  editionId?: string | null
  chapterId?: string | null
  pageIndex?: number | null
  scrollRatio?: number | null
  note?: string | null
  createdAt: string
  title: Title
  edition?: Edition | null
  chapter?: Chapter | null
}

export interface CreateBookmarkInput {
  titleId: string
  editionId?: string | null
  chapterId?: string | null
  pageIndex?: number | null
  scrollRatio?: number | null
  note?: string | null
}
