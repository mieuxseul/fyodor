import { useEffect, useState } from 'react'

import {
  hasNewChapters,
  newChapterDelta,
  subscribeChapterSeen,
} from '@/lib/chapter-seen'

export function useNewChapterBadge(
  providerId?: string | null,
  titleId?: string | null,
): { show: boolean; delta: number } {
  const [show, setShow] = useState(false)
  const [delta, setDelta] = useState(0)

  useEffect(() => {
    if (!providerId || !titleId) {
      setShow(false)
      setDelta(0)
      return
    }
    const refresh = () => {
      setShow(hasNewChapters(providerId, titleId))
      setDelta(newChapterDelta(providerId, titleId))
    }
    refresh()
    return subscribeChapterSeen(refresh)
  }, [providerId, titleId])

  return { show, delta }
}
