import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { BookmarksPage } from '@/pages/BookmarksPage'
import { DiscoverPage } from '@/pages/DiscoverPage'
import { DownloadsPage } from '@/pages/DownloadsPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { ReaderPage } from '@/pages/ReaderPage'
import { RemoteTitlePage } from '@/pages/RemoteTitlePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SourcesPage } from '@/pages/SourcesPage'
import { TitleDetailsPage } from '@/pages/TitleDetailsPage'

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/library" replace />} />
        <Route path="discover" element={<DiscoverPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="reading" element={<Navigate to="/library" replace />} />
        <Route path="title/:titleId" element={<TitleDetailsPage />} />
        <Route path="remote/:providerId/:titleId" element={<RemoteTitlePage />} />
        <Route path="downloads" element={<DownloadsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="bookmarks" element={<BookmarksPage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="reader/:editionId" element={<ReaderPage />} />
      <Route path="*" element={<Navigate to="/library" replace />} />
    </Routes>
  )
}
