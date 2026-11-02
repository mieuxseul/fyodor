import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api, isTauri, toAssetUrl } from '@/lib/api'
import type { LibraryItem } from '@/lib/types'
import { Button } from '@/components/ui/Button'

interface SearchPaletteProps {
  open: boolean
  onClose: () => void
}

export function SearchPalette({ open, onClose }: SearchPaletteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const handle = window.setTimeout(async () => {
      const trimmed = query.trim()
      if (!trimmed) {
        setResults([])
        setError(null)
        return
      }
      if (!isTauri()) {
        setError('Desktop runtime required for library search.')
        return
      }
      setLoading(true)
      setError(null)
      try {
        const items = await api.searchLibrary(trimmed)
        setResults(items)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => window.clearTimeout(handle)
  }, [query, open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-black/35 backdrop-blur-md"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search library"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)] shadow-2xl"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your library…"
          className="w-full border-b border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)] px-4 py-3 outline-none"
        />
        <div className="max-h-80 overflow-y-auto bg-[var(--fy-panel-solid)] p-2">
          {loading ? (
            <p className="px-2 py-4 text-sm text-[var(--fy-text-muted)]">Searching…</p>
          ) : null}
          {error ? <p className="px-2 py-4 text-sm text-[var(--fy-danger)]">{error}</p> : null}
          {!loading && !error && query.trim() && results.length === 0 ? (
            <p className="px-2 py-4 text-sm text-[var(--fy-text-muted)]">No library matches.</p>
          ) : null}
          {results.map((item) => (
            <button
              key={item.title.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--fy-nav-hover)]"
              onClick={() => {
                onClose()
                navigate(`/title/${item.title.id}`)
              }}
            >
              <div className="h-12 w-9 overflow-hidden rounded-md bg-[var(--fy-bg)]">
                {item.title.coverPath ? (
                  <img
                    src={toAssetUrl(item.title.coverPath)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm">{item.title.primaryTitle}</div>
                <div className="font-mono text-[11px] text-[var(--fy-text-muted)]">
                  {item.entry.status}
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="flex justify-end border-t border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)] px-3 py-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
