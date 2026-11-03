export function DiscoverGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden fy-liquid-tile"
        >
          <div className="aspect-[2/3] animate-pulse bg-[var(--fy-bg)]" />
          <div className="space-y-2 px-2.5 py-2.5">
            <div className="h-3 w-4/5 animate-pulse rounded bg-[var(--fy-bg)]" />
            <div className="h-2.5 w-2/3 animate-pulse rounded bg-[var(--fy-bg)]" />
            <div className="h-2 w-1/2 animate-pulse rounded bg-[var(--fy-bg)]" />
          </div>
        </div>
      ))}
    </div>
  )
}
