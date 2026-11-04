export interface LibraryCategory {
  id: string
  name: string
  /** Built-in categories map to library entry status when assigned */
  status?: string
  builtin?: boolean
}

const STORAGE_KEY = 'fyodor.libraryCategories.v1'
const EVENT = 'fyodor-library-categories'

const BUILTIN: LibraryCategory[] = [
  { id: 'reading', name: 'Reading', status: 'reading', builtin: true },
  { id: 'finished', name: 'Finished', status: 'completed', builtin: true },
  { id: 'planned', name: 'Planned', status: 'planned', builtin: true },
  { id: 'on_hold', name: 'On hold', status: 'on_hold', builtin: true },
  { id: 'dropped', name: 'Dropped', status: 'dropped', builtin: true },
]

type Store = {
  custom: LibraryCategory[]
  /** titleId → categoryId */
  assignments: Record<string, string>
}

function read(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { custom: [], assignments: {} }
    const parsed = JSON.parse(raw) as Partial<Store>
    return {
      custom: Array.isArray(parsed.custom)
        ? parsed.custom.filter(
            (c): c is LibraryCategory =>
              Boolean(c && typeof c.id === 'string' && typeof c.name === 'string'),
          )
        : [],
      assignments:
        parsed.assignments && typeof parsed.assignments === 'object'
          ? (parsed.assignments as Record<string, string>)
          : {},
    }
  } catch {
    return { custom: [], assignments: {} }
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* ignore */
  }
}

export function listCategories(): LibraryCategory[] {
  const store = read()
  return [...BUILTIN, ...store.custom]
}

export function createCategory(name: string): LibraryCategory {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Category name required')
  const store = read()
  const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
  const category: LibraryCategory = { id, name: trimmed, builtin: false }
  store.custom.push(category)
  write(store)
  return category
}

export function renameCategory(id: string, name: string): void {
  const trimmed = name.trim()
  if (!trimmed) return
  const store = read()
  const cat = store.custom.find((c) => c.id === id)
  if (!cat) return
  cat.name = trimmed
  write(store)
}

export function deleteCategory(id: string): void {
  const store = read()
  store.custom = store.custom.filter((c) => c.id !== id)
  for (const [titleId, catId] of Object.entries(store.assignments)) {
    if (catId === id) delete store.assignments[titleId]
  }
  write(store)
}

export function getTitleCategoryId(titleId: string, fallbackStatus?: string | null): string {
  const store = read()
  if (store.assignments[titleId]) return store.assignments[titleId]
  if (fallbackStatus === 'completed') return 'finished'
  if (fallbackStatus && BUILTIN.some((c) => c.status === fallbackStatus)) {
    return BUILTIN.find((c) => c.status === fallbackStatus)!.id
  }
  return 'reading'
}

export function setTitleCategory(titleId: string, categoryId: string): LibraryCategory | null {
  const categories = listCategories()
  const category = categories.find((c) => c.id === categoryId) ?? null
  if (!category) return null
  const store = read()
  store.assignments[titleId] = categoryId
  write(store)
  return category
}

export function subscribeLibraryCategories(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}
