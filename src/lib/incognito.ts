const PRIVATE_KEY = 'fyodor.privateTitles.v1'
const SESSION_KEY = 'fyodor.incognitoSession.v1'
const EVENT = 'fyodor-incognito'

type PrivateStore = {
  /** Title / edition ids that should stay out of history. */
  ids: string[]
}

function readPrivate(): Set<string> {
  try {
    const raw = localStorage.getItem(PRIVATE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as PrivateStore
    const ids = Array.isArray(parsed.ids) ? parsed.ids.filter((id) => typeof id === 'string') : []
    return new Set(ids)
  } catch {
    return new Set()
  }
}

function writePrivate(ids: Set<string>): void {
  try {
    localStorage.setItem(PRIVATE_KEY, JSON.stringify({ ids: [...ids] } satisfies PrivateStore))
  } catch {
    /* ignore quota */
  }
  emit()
}

function emit(): void {
  try {
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* ignore */
  }
}

export function listPrivateTitleIds(): string[] {
  return [...readPrivate()]
}

export function isTitlePrivate(...ids: Array<string | null | undefined>): boolean {
  const store = readPrivate()
  return ids.some((id) => Boolean(id && store.has(id)))
}

export function setTitlePrivate(
  privateFlag: boolean,
  ...ids: Array<string | null | undefined>
): void {
  const store = readPrivate()
  const cleaned = ids.filter((id): id is string => Boolean(id))
  if (cleaned.length === 0) return
  for (const id of cleaned) {
    if (privateFlag) store.add(id)
    else store.delete(id)
  }
  writePrivate(store)
}

export function isIncognitoSession(): boolean {
  try {
    return localStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function setIncognitoSession(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(SESSION_KEY, '1')
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
  emit()
}

/** True when reading activity should skip history. */
export function shouldSuppressActivity(
  ...ids: Array<string | null | undefined>
): boolean {
  return isIncognitoSession() || isTitlePrivate(...ids)
}

export function filterPublicHistory<T extends { title: { id: string }; edition: { id: string } }>(
  items: T[],
): T[] {
  if (items.length === 0) return items
  const store = readPrivate()
  if (store.size === 0) return items
  return items.filter(
    (item) => !store.has(item.title.id) && !store.has(item.edition.id),
  )
}

export function subscribeIncognito(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}
