import { useEffect, useState } from 'react'

import {
  getLibraryDisplayPrefs,
  subscribeLibraryDisplay,
  type LibraryDisplayPrefs,
} from '@/lib/library-display'

/** Live display prefs (mode + grid size) shared by Library, Discover, Suggestions, etc. */
export function useDisplayPrefs(): LibraryDisplayPrefs {
  const [prefs, setPrefs] = useState<LibraryDisplayPrefs>(() => getLibraryDisplayPrefs())
  useEffect(() => subscribeLibraryDisplay(() => setPrefs(getLibraryDisplayPrefs())), [])
  return prefs
}
