import { useEffect, useState } from 'react'

import { resolveCoverUrl } from '@/lib/api'
import { cn } from '@/lib/cn'

interface RemoteCoverProps {
  path?: string | null
  className?: string
  /** Shown when path is missing or the image fails to load */
  placeholder?: string
  alt?: string
}

/** Resolves local asset paths and remote provider covers. */
export function RemoteCover({
  path,
  className,
  placeholder,
  alt = '',
}: RemoteCoverProps) {
  const [src, setSrc] = useState<string | undefined>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSrc(undefined)
    setFailed(false)
    void resolveCoverUrl(path).then((url) => {
      if (!cancelled) setSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [path])

  if (!src || failed) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-[var(--fy-bg)] px-2 text-center text-xs text-[var(--fy-text-muted)]',
          className,
        )}
      >
        <span className="line-clamp-4">{placeholder || 'No cover'}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className ?? 'h-full w-full object-cover'}
      onError={() => setFailed(true)}
    />
  )
}
