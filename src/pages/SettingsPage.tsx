import { useEffect, useState } from 'react'
import { getVersion } from '@tauri-apps/api/app'
import { save } from '@tauri-apps/plugin-dialog'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { useTheme } from '@/app/ThemeProvider'
import { api, isTauri } from '@/lib/api'
import { checkForAppUpdate } from '@/lib/updater'
import type { AppPaths, ThemePreference } from '@/lib/types'

export function SettingsPage() {
  const { preference, setPreference } = useTheme()
  const [paths, setPaths] = useState<AppPaths | null>(null)
  const [defaultMode, setDefaultMode] = useState('page')
  const [defaultDirection, setDefaultDirection] = useState('ltr')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [appVersion, setAppVersion] = useState<string>('…')
  const [updateBusy, setUpdateBusy] = useState(false)
  const [pendingInstall, setPendingInstall] = useState<(() => Promise<void>) | null>(null)

  useEffect(() => {
    if (!isTauri()) {
      setAppVersion('web')
      return
    }
    void (async () => {
      try {
        const [appPaths, mode, direction, version] = await Promise.all([
          api.getAppPaths(),
          api.getSetting('default_reading_mode'),
          api.getSetting('default_reading_direction'),
          getVersion(),
        ])
        setPaths(appPaths)
        setAppVersion(version)
        if (mode) setDefaultMode(mode)
        if (direction) setDefaultDirection(direction)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
  }, [])

  async function checkUpdates() {
    if (!isTauri()) return
    setUpdateBusy(true)
    setError(null)
    setNotice(null)
    setPendingInstall(null)
    try {
      const result = await checkForAppUpdate()
      if (result.status === 'up-to-date') {
        setNotice(`You're on the latest version (${result.version}).`)
      } else if (result.status === 'available') {
        setNotice(
          `Update ${result.version} is available (current ${result.currentVersion}). Install to download and relaunch.`,
        )
        setPendingInstall(() => result.install)
      } else if (result.status === 'unsupported') {
        setNotice('Updates require the desktop app.')
      } else {
        setError(
          `${result.message} If you installed the portable .exe, grab the latest NSIS setup from Releases instead.`,
        )
        await api.openExternalUrl(
          'https://github.com/rickshank-rickdemption/fyodor/releases/latest',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUpdateBusy(false)
    }
  }

  async function installUpdate() {
    if (!pendingInstall) return
    setUpdateBusy(true)
    setError(null)
    try {
      setNotice('Downloading update… Fyodor will relaunch when ready.')
      await pendingInstall()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setUpdateBusy(false)
    }
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
        title: 'Backup Fyodor database',
        defaultPath: 'fyodor-backup.db',
        filters: [{ name: 'SQLite', extensions: ['db'] }],
      })
      if (!destination) return
      const saved = await api.backupDatabase(destination)
      setNotice(`Database backed up to ${saved}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Appearance, reading preferences, and local data."
      />

      {notice ? (
        <p className="mb-4 rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-panel)] px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}
      {error ? <p className="mb-4 text-sm text-[var(--fy-danger)]">{error}</p> : null}

      <div className="space-y-8">
        <section className="rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-panel)] p-4">
          <h2 className="font-display text-2xl">Updates</h2>
          <div className="fy-divider my-3" />
          <p className="text-sm text-[var(--fy-text-muted)]">
            Version <span className="font-mono text-[var(--fy-text)]">{appVersion}</span>
            . Installer builds can update in-app; portable exe users should use GitHub Releases.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={!isTauri() || updateBusy}
              onClick={() => void checkUpdates()}
            >
              Check for updates
            </Button>
            {pendingInstall ? (
              <Button
                variant="primary"
                disabled={updateBusy}
                onClick={() => void installUpdate()}
              >
                Install update
              </Button>
            ) : null}
            <Button
              variant="ghost"
              disabled={!isTauri()}
              onClick={() =>
                void api.openExternalUrl(
                  'https://github.com/rickshank-rickdemption/fyodor/releases/latest',
                )
              }
            >
              Open Releases
            </Button>
          </div>
        </section>

        <section className="rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-panel)] p-4">
          <h2 className="font-display text-2xl">Appearance</h2>
          <div className="fy-divider my-3" />
          <div className="flex flex-wrap gap-2">
            {(['dark', 'light', 'system'] as ThemePreference[]).map((theme) => (
              <Button
                key={theme}
                variant={preference === theme ? 'primary' : 'secondary'}
                onClick={() => void setPreference(theme)}
              >
                {theme === 'dark'
                  ? 'Monochrome Dark'
                  : theme === 'light'
                    ? 'Monochrome Light'
                    : 'System'}
              </Button>
            ))}
          </div>
        </section>

        <section className="rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-panel)] p-4">
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
                <option value="page">Page-based</option>
                <option value="vertical">Vertical</option>
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
            <Button variant="primary" disabled={!isTauri()} onClick={() => void persistReadingDefaults()}>
              Save reading defaults
            </Button>
          </div>
          <p className="mt-3 text-xs text-[var(--fy-text-muted)]">
            Shortcuts: ←/→ pages, Space/PgDn next, +/- zoom, F fullscreen, Esc exit, comma opens reader settings.
          </p>
        </section>

        <section className="rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-panel)] p-4">
          <h2 className="font-display text-2xl">Data & privacy</h2>
          <div className="fy-divider my-3" />
          {paths ? (
            <dl className="space-y-2 font-mono text-xs text-[var(--fy-text-muted)]">
              <div>
                <dt>Data directory</dt>
                <dd className="text-[var(--fy-text)]">{paths.dataDir}</dd>
              </div>
              <div>
                <dt>Database</dt>
                <dd className="text-[var(--fy-text)]">{paths.databasePath}</dd>
              </div>
              <div>
                <dt>Covers cache</dt>
                <dd className="text-[var(--fy-text)]">{paths.coversDir}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-[var(--fy-text-muted)]">
              Paths are available inside the desktop app.
            </p>
          )}
          <div className="mt-4">
            <Button variant="secondary" disabled={!isTauri()} onClick={() => void backupDb()}>
              Backup database
            </Button>
          </div>
          <p className="mt-3 text-xs text-[var(--fy-text-muted)]">
            Backups include library metadata only, not your original manga files.
          </p>
        </section>
      </div>
    </div>
  )
}
