import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

export function DownloadsPage() {
  return (
    <div>
      <PageHeader
        title="Downloads"
        subtitle="Offline chapters from authorized providers will appear here."
      />
      <EmptyState
        title="No downloads"
        description="Online downloads are deferred until a permitted provider integration is available. Local imports are managed from Library."
      />
    </div>
  )
}
