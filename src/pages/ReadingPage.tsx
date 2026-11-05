import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { CoverCard } from '@/components/library/CoverCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useDisplayPrefs } from '@/hooks/useDisplayPrefs'
import { api, isTauri } from '@/lib/api'
import { cn } from '@/lib/cn'
import { gridColsClass } from '@/lib/library-display'
import type { LibraryItem } from '@/lib/types'

export function ReadingPage() {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const display = useDisplayPrefs()

  useEffect(() => {
    if (!isTauri()) return
    void api
      .listLibrary({ status: 'reading', sort: 'recent' })
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  return (
    <div>
      <PageHeader
        title="Reading"
        subtitle="Titles marked as currently reading."
        actions={
          <Button variant="secondary" onClick={() => navigate('/library')}>
            Library
          </Button>
        }
      />
      {error ? <p className="mb-4 text-sm text-[var(--fy-danger)]">{error}</p> : null}
      {items.length === 0 ? (
        <EmptyState
          title="Nothing in progress"
          description="Set a library title’s status to Reading, or continue from a recently opened book."
          action={
            <Button variant="primary" onClick={() => navigate('/library')}>
              Browse library
            </Button>
          }
        />
      ) : display.mode === 'details' ? (
        <div className="divide-y divide-[var(--fy-border-subtle)]">
          {items.map((item) => (
            <CoverCard key={item.title.id} item={item} view="details" />
          ))}
        </div>
      ) : (
        <div className={cn('grid gap-3', gridColsClass(display.gridSize))}>
          {items.map((item) => (
            <CoverCard
              key={item.title.id}
              item={item}
              view={display.mode === 'compact' ? 'compact' : 'grid'}
            />
          ))}
        </div>
      )}
    </div>
  )
}
