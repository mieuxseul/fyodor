import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { CoverCard } from '@/components/library/CoverCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { api, isTauri } from '@/lib/api'
import type { LibraryItem } from '@/lib/types'

export function ReadingPage() {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

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
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <CoverCard key={item.title.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
