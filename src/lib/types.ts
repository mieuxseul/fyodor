export type ReadingStatus =
  | 'reading'
  | 'completed'
  | 'planned'
  | 'on_hold'
  | 'dropped'

export type ThemePreference = 'dark' | 'light' | 'system'
export type LibraryView = 'grid' | 'list' | 'compact' | 'details'
export type ReadingMode = 'page' | 'double' | 'vertical'
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
  /** 0–100 reading progress through chapters */
  progressPercent?: number
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

export interface StorageUsage {
  savedMangaBytes: number
  pagesCacheBytes: number
  otherCacheBytes: number
  databaseBytes: number
  availableBytes?: number | null
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
  /** Skip last-opened / history side effects (incognito or private title). */
  suppressActivity?: boolean
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

export interface DownloadRecord {
  id: string
  editionId?: string | null
  chapterId?: string | null
  providerId?: string | null
  providerTitleId?: string | null
  remoteChapterId?: string | null
  titleLabel?: string | null
  chapterTitle?: string | null
  status: string
  progress: number
  error?: string | null
  createdAt: string
  updatedAt: string
}

export interface EnqueueDownloadInput {
  providerId: string
  providerName: string
  providerTitleId: string
  remoteChapterId: string
  chapterTitle: string
  primaryTitle: string
  coverUrl?: string | null
  contentType?: string | null
}

export interface UserProfile {
  displayName: string
  bio?: string | null
  avatarPath?: string | null
  showRecentActivity: boolean
  createdAt: string
  updatedAt: string
}

export interface UpdateProfileInput {
  displayName?: string
  bio?: string | null
  avatarPath?: string | null
  clearAvatar?: boolean
  showRecentActivity?: boolean
}

export interface SocialTitle {
  id: string
  kind: string
  localTitleId?: string | null
  providerId?: string | null
  providerTitleId?: string | null
  primaryTitle: string
  coverPath?: string | null
  author?: string | null
  contentType: string
  createdAt: string
  updatedAt: string
}

export interface SocialTitleInput {
  kind: 'local' | 'remote' | string
  localTitleId?: string | null
  providerId?: string | null
  providerTitleId?: string | null
  primaryTitle: string
  coverPath?: string | null
  author?: string | null
  contentType?: string | null
}

export interface ProfileFavorite {
  slot: number
  title: SocialTitle
  updatedAt: string
}

export interface TitleSocialState {
  title: SocialTitle
  rating?: number | null
  liked: boolean
  favoriteSlot?: number | null
}

export interface DiaryEntry {
  id: string
  title: SocialTitle
  loggedOn: string
  rating?: number | null
  review?: string | null
  liked: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateDiaryInput {
  title: SocialTitleInput
  loggedOn: string
  rating?: number | null
  review?: string | null
  liked?: boolean
}

export interface UpdateDiaryInput {
  id: string
  loggedOn?: string
  rating?: number | null
  clearRating?: boolean
  review?: string | null
  liked?: boolean
}

export interface ActivityEvent {
  id: string
  kind: string
  title?: SocialTitle | null
  payload: Record<string, unknown>
  createdAt: string
}

export interface SetFavoriteInput {
  slot: number
  title: SocialTitleInput
}

export interface SetRatingInput {
  title: SocialTitleInput
  rating?: number | null
}

export interface ToggleLikeInput {
  title: SocialTitleInput
}
