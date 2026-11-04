import { useEffect, useState } from 'react'
import { open, save } from '@tauri-apps/plugin-dialog'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { useTheme } from '@/app/ThemeProvider'
import { api, isTauri } from '@/lib/api'
import {
  getAppPrefs,
  setAppPrefs,
  subscribeAppPrefs,
  type AppPrefs,
} from '@/lib/app-prefs'
import {
  getLibraryDisplayPrefs,
  setLibraryDisplayPrefs,
  type LibraryDisplayPrefs,
} from '@/lib/library-display'
import {
  isIncognitoSession,
  setIncognitoSession,
  subscribeIncognito,
} from '@/lib/incognito'
import type { AppPaths, StorageUsage, ThemePreference } from '@/lib/types'

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let n = value
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description?: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-[var(--fy-text-muted)]">{description}</span>
        ) : null}
      </span>
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

export function SettingsPage() {
  const { preference, setPreference } = useTheme()
  const [paths, setPaths] = useState<AppPaths | null>(null)
  const [storage, setStorage] = useState<StorageUsage | null>(null)
  const [defaultMode, setDefaultMode] = useState('page')
  const [defaultDirection, setDefaultDirection] = useState('ltr')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<string | null>(null)
  const [incognito, setIncognito] = useState(() => isIncognitoSession())
  const [prefs, setPrefs] = useState<AppPrefs>(() => getAppPrefs())
  const [display, setDisplay] = useState<LibraryDisplayPrefs>(() => getLibraryDisplayPrefs())

  useEffect(() => subscribeIncognito(() => setIncognito(isIncognitoSession())), [])
  useEffect(() => subscribeAppPrefs(() => setPrefs(getAppPrefs())), [])

  useEffect(() => {
    if (!isTauri()) return
    void (async () => {
      try {
        const [appPaths, mode, direction, usage] = await Promise.all([
          api.getAppPaths(),
          api.getSetting('default_reading_mode'),
          api.getSetting('default_reading_direction'),
          api.getStorageUsage().catch(() => null),
        ])
        setPaths(appPaths)
        setStorage(usage)
        if (mode) setDefaultMode(mode)
        if (direction) setDefaultDirection(direction)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
  }, [])

  function patchPrefs(patch: Partial<AppPrefs>) {
    setPrefs(setAppPrefs(patch))
  }

  function patchDisplay(patch: Partial<LibraryDisplayPrefs>) {
    setDisplay(setLibraryDisplayPrefs(patch))
  }

  async function persistReadingDefaults() {
    if (!isTauri()) return
    await api.setSetting('default_reading_mode', defaultMode)
    await api.setSetting('default_reading_direction', defaultDirection)
    setNotice('Reading defaults saved.')
  }

  async function backupDb() {
    if (!isTauri()) return
    try {
      const destination = await save({
        title: 'Create data backup',
        defaultPath: 'fyodor-backup.db',
        filters: [{ name: 'SQLite', extensions: ['db'] }],
      })
      if (!destination) return
      const saved = await api.backupDatabase(destination)
      setNotice(`Backup created at ${saved}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function restoreDb() {
    if (!isTauri()) return
    try {
      const source = await open({
        title: 'Restore from backup',
        multiple: false,
        filters: [{ name: 'SQLite', extensions: ['db'] }],
      })
      if (!source || Array.isArray(source)) return
      if (
        !window.confirm(
          'Restore will replace your current library database. Restart the app after restore. Continue?',
        )
      ) {
        return
      }
      await api.restoreDatabase(source)
      setNotice('Database restored. Restart Fyodor to load the backup.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function clearCache() {
    if (!isTauri()) return
    try {
      const freed = await api.clearPagesCache()
      const usage = await api.getStorageUsage()
      setStorage(usage)
      setNotice(`Cleared pages cache (${formatBytes(freed)}).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function checkUpdates() {
    if (!isTauri()) return
    setUpdateBusy(true)
    setError(null)
    setUpdateInfo(null)
    try {
      const result = await api.checkForUpdates()
      if (result.updateAvailable) {
        setUpdateInfo(
          `Update available: v${result.latestVersion} (you have v${result.currentVersion}).`,
        )
        setNotice('A newer release is on GitHub.')
      } else {
        setUpdateInfo(`You’re on the latest release (v${result.currentVersion}).`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUpdateBusy(false)
    }
  }

  const storageTotal =
    (storage?.savedMangaBytes ?? 0) +
    (storage?.pagesCacheBytes ?? 0) +
    (storage?.otherCacheBytes ?? 0)

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Appearance, services, backup, storage, and privacy."
      />

      {notice ? (
        <p className="mb-4 fy-liquid-tile px-3 py-2 text-sm">{notice}</p>
      ) : null}
      {error ? <p className="mb-4 text-sm text-[var(--fy-danger)]">{error}</p> : null}

      <div className="space-y-8">
        <section className="fy-liquid-tile p-4">
          <h2 className="font-display text-2xl">Appearance</h2>
          <div className="fy-divider my-3" />
          <div className="mb-3 flex flex-wrap gap-2">
            {(['dark', 'light', 'system'] as ThemePreference[]).map((theme) => (
              <Button
                key={theme}
                variant={preference === theme ? 'primary' : 'secondary'}
                onClick={() => void setPreference(theme)}
              >
                {theme === 'dark'
                  ? 'Dark'
                  : theme === 'light'
                    ? 'Light'
                    : 'Follow system'}
              </Button>
            ))}
          </div>
          <ToggleRow
            title="Black (AMOLED)"
            description="Uses less power on OLED screens when dark theme is on."
            checked={prefs.amoledBlack}
            onChange={(v) => patchPrefs({ amoledBlack: v })}
          />
          <ToggleRow
            title="Show reading progress indicators"
            description="Percent read on library covers."
            checked={prefs.showProgressIndicators}
            onChange={(v) => patchPrefs({ showProgressIndicators: v })}
          />
          <ToggleRow
            title="Badges in lists"
            description="New-chapter counts and similar badges."
            checked={prefs.showListBadges}
            onChange={(v) => patchPrefs({ showListBadges: v })}
          />
          <ToggleRow
            title="Show quick filters"
            description="On device / New chapters / Completed chips in Library."
            checked={prefs.showQuickFilters}
            onChange={(v) => patchPrefs({ showQuickFilters: v })}
          />
          <ToggleRow
            title="Collapse long description"
            description="Truncate synopsis on title pages."
            checked={prefs.collapseLongDescription}
            onChange={(v) => patchPrefs({ collapseLongDescription: v })}
          />
          <ToggleRow
            title="Show floating Continue button"
            description="One-tap resume from history when available (hidden in incognito)."
            checked={prefs.floatingContinue}
            onChange={(v) => patchPrefs({ floatingContinue: v })}
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Cover layout (Library, Discover, …)
              <select
                value={display.mode}
                onChange={(e) =>
                  patchDisplay({ mode: e.target.value as LibraryDisplayPrefs['mode'] })
                }
                className="mt-1 w-full rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2"
              >
                <option value="grid">Grid</option>
                <option value="details">Details</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            <label className="text-sm">
              Grid size ({display.gridSize})
              <input
                type="range"
                min={2}
                max={8}
                value={display.gridSize}
                onChange={(e) => patchDisplay({ gridSize: Number(e.target.value) })}
                className="mt-3 w-full"
              />
            </label>
          </div>
        </section>

        <section className="fy-liquid-tile p-4">
          <h2 className="font-display text-2xl">Services</h2>
          <div className="fy-divider my-3" />
          <ToggleRow
            title="Related manga"
            description="Show related titles when sources provide them (may be incomplete)."
            checked={prefs.relatedManga}
            onChange={(v) => patchPrefs({ relatedManga: v })}
          />
          <ToggleRow
            title="Reading statistics"
            description="Keep local reading activity counters (UI currently off)."
            checked={prefs.readingStatistics}
            onChange={(v) => patchPrefs({ readingStatistics: v })}
          />
          <ToggleRow
            title="Show estimated reading time"
            description="Estimates may be inaccurate."
            checked={prefs.estimatedReadingTime}
            onChange={(v) => patchPrefs({ estimatedReadingTime: v })}
          />
        </section>

        <section className="fy-liquid-tile p-4">
          <h2 className="font-display text-2xl">Backup and restore</h2>
          <div className="fy-divider my-3" />
          <p className="mb-3 text-sm text-[var(--fy-text-muted)]">
            Create a backup of your library database, or restore a previous one.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={!isTauri()} onClick={() => void backupDb()}>
              Create data backup
            </Button>
            <Button variant="secondary" disabled={!isTauri()} onClick={() => void restoreDb()}>
              Restore from backup
            </Button>
          </div>
          <ToggleRow
            title="Periodic backups"
            description="Reminder preference only for now — automatic scheduling lands later."
            checked={prefs.periodicBackups}
            onChange={(v) => patchPrefs({ periodicBackups: v })}
          />
        </section>

        <section className="fy-liquid-tile p-4">
          <h2 className="font-display text-2xl">Storage and network</h2>
          <div className="fy-divider my-3" />
          {storage ? (
            <div className="mb-4 space-y-2">
              <div className="flex h-2 overflow-hidden rounded-full bg-[var(--fy-border-subtle)]">
                <div
                  className="bg-sky-500"
                  style={{
                    width: `${storageTotal ? (storage.savedMangaBytes / storageTotal) * 100 : 0}%`,
                  }}
                />
                <div
                  className="bg-rose-500"
                  style={{
                    width: `${storageTotal ? (storage.pagesCacheBytes / storageTotal) * 100 : 0}%`,
                  }}
                />
                <div
                  className="bg-emerald-500"
                  style={{
                    width: `${storageTotal ? (storage.otherCacheBytes / storageTotal) * 100 : 0}%`,
                  }}
                />
              </div>
              <ul className="space-y-1 text-xs text-[var(--fy-text-muted)]">
                <li>Saved covers: {formatBytes(storage.savedMangaBytes)}</li>
                <li>Pages cache: {formatBytes(storage.pagesCacheBytes)}</li>
                <li>Other / database: {formatBytes(storage.otherCacheBytes)}</li>
              </ul>
            </div>
          ) : (
            <p className="mb-3 text-sm text-[var(--fy-text-muted)]">Storage usage loads in the desktop app.</p>
          )}
          <div className="mb-3 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!isTauri()} onClick={() => void clearCache()}>
              Data removal — clear pages cache
            </Button>
          </div>
          <label className="mb-2 block text-sm">
            Content preloading
            <select
              value={prefs.contentPreloading}
              onChange={(e) =>
                patchPrefs({
                  contentPreloading: e.target.value as AppPrefs['contentPreloading'],
                })
              }
              className="mt-1 w-full rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2"
            >
              <option value="never">Never</option>
              <option value="wifi">Only on Wi-Fi</option>
              <option value="always">Always</option>
            </select>
          </label>
          <label className="block text-sm">
            Preload pages
            <select
              value={prefs.preloadPages}
              onChange={(e) =>
                patchPrefs({ preloadPages: e.target.value as AppPrefs['preloadPages'] })
              }
              className="mt-1 w-full rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2"
            >
              <option value="never">Never</option>
              <option value="wifi">Only on Wi-Fi</option>
              <option value="always">Always</option>
            </select>
          </label>
          <p className="mt-3 text-xs text-[var(--fy-text-muted)]">
            Proxy / DNS over HTTPS / image optimization proxy are not configured yet.
          </p>
        </section>

        <section className="fy-liquid-tile p-4">
          <h2 className="font-display text-2xl">Reading</h2>
          <div className="fy-divider my-3" />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Default mode
              <select
                value={defaultMode}
                onChange={(e) => setDefaultMode(e.target.value)}
                className="mt-1 w-full rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2"
              >
                <option value="page">Single page</option>
                <option value="double">Double page</option>
                <option value="vertical">Webtoon / vertical</option>
              </select>
            </label>
            <label className="text-sm">
              Default direction
              <select
                value={defaultDirection}
                onChange={(e) => setDefaultDirection(e.target.value)}
                className="mt-1 w-full rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2"
              >
                <option value="ltr">Left to right</option>
                <option value="rtl">Right to left</option>
              </select>
            </label>
          </div>
          <div className="mt-3">
            <Button
              variant="primary"
              disabled={!isTauri()}
              onClick={() => void persistReadingDefaults()}
            >
              Save reading defaults
            </Button>
          </div>
          <p className="mt-3 text-xs text-[var(--fy-text-muted)]">
            Reader shortcuts: ←/→, Space/PgDn, +/- zoom, F / F11 fullscreen, Esc exit, comma settings, ?
            cheatsheet.
          </p>
        </section>

        <section className="fy-liquid-tile p-4">
          <h2 className="font-display text-2xl">Privacy</h2>
          <div className="fy-divider my-3" />
          <ToggleRow
            title="Incognito session"
            description="Skip history and Continue reading until turned off."
            checked={incognito}
            onChange={(v) => {
              setIncognitoSession(v)
              setIncognito(v)
            }}
          />
          <ToggleRow
            title="Exit confirmation"
            description="Ask before closing the window (desktop hook lands with window events)."
            checked={prefs.exitConfirmation}
            onChange={(v) => patchPrefs({ exitConfirmation: v })}
          />
          <p className="mt-2 text-xs text-[var(--fy-text-muted)]">
            App password lock and screenshot policy are not available on desktop yet.
          </p>
        </section>

        <section className="fy-liquid-tile p-4">
          <h2 className="font-display text-2xl">Data &amp; updates</h2>
          <div className="fy-divider my-3" />
          {paths ? (
            <dl className="mb-3 space-y-1 font-mono text-xs text-[var(--fy-text-muted)]">
              <div>
                <dt className="inline text-[var(--fy-text)]">Data · </dt>
                <dd className="inline break-all">{paths.dataDir}</dd>
              </div>
              <div>
                <dt className="inline text-[var(--fy-text)]">Database · </dt>
                <dd className="inline break-all">{paths.databasePath}</dd>
              </div>
            </dl>
          ) : null}
          <Button
            variant="secondary"
            disabled={!isTauri() || updateBusy}
            onClick={() => void checkUpdates()}
          >
            {updateBusy ? 'Checking…' : 'Check for updates'}
          </Button>
          {updateInfo ? (
            <p className="mt-2 text-sm text-[var(--fy-text-muted)]">{updateInfo}</p>
          ) : null}
        </section>
      </div>
    </div>
  )
}
