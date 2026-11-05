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
  /** Built-in category ids the user removed from the library tabs. */
  hiddenBuiltinIds: string[]
  /** Display order of category ids (All is always separate / first in the UI). */
  order: string[]
}

function read(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { custom: [], assignments: {}, hiddenBuiltinIds: [], order: [] }
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
      hiddenBuiltinIds: Array.isArray(parsed.hiddenBuiltinIds)
        ? parsed.hiddenBuiltinIds.filter((id): id is string => typeof id === 'string')
        : [],
      order: Array.isArray(parsed.order)
        ? parsed.order.filter((id): id is string => typeof id === 'string')
        : [],
    }
  } catch {
    return { custom: [], assignments: {}, hiddenBuiltinIds: [], order: [] }
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

function visibleBuiltin(store: Store): LibraryCategory[] {
  const hidden = new Set(store.hiddenBuiltinIds)
  return BUILTIN.filter((category) => !hidden.has(category.id))
}

function applyOrder(categories: LibraryCategory[], order: string[]): LibraryCategory[] {
  if (order.length === 0) return categories
  const byId = new Map(categories.map((category) => [category.id, category]))
  const ordered: LibraryCategory[] = []
  for (const id of order) {
    const category = byId.get(id)
    if (category) {
      ordered.push(category)
      byId.delete(id)
    }
  }
  for (const category of byId.values()) ordered.push(category)
  return ordered
}

export function listCategories(): LibraryCategory[] {
  const store = read()
  return applyOrder([...visibleBuiltin(store), ...store.custom], store.order)
}

export function createCategory(name: string): LibraryCategory {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Category name required')
  const store = read()
  const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
  const category: LibraryCategory = { id, name: trimmed, builtin: false }
  const prevIds = listCategoryIds(store)
  store.custom.push(category)
  store.order = [...prevIds, id]
  write(store)
  return category
}

function listCategoryIds(store: Store): string[] {
  return applyOrder([...visibleBuiltin(store), ...store.custom], store.order).map((c) => c.id)
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

/** Delete a library tab category. "All" is not a category and cannot be deleted. */
export function deleteCategory(id: string): void {
  if (id === 'all') return
  const store = read()
  const isBuiltin = BUILTIN.some((category) => category.id === id)
  if (isBuiltin) {
    if (!store.hiddenBuiltinIds.includes(id)) store.hiddenBuiltinIds.push(id)
  } else {
    store.custom = store.custom.filter((c) => c.id !== id)
  }
  store.order = store.order.filter((entry) => entry !== id)
  for (const [titleId, catId] of Object.entries(store.assignments)) {
    if (catId === id) delete store.assignments[titleId]
  }
  write(store)
}

/** Move a category one step left (-1) or right (+1) in the tab bar. */
export function moveCategory(id: string, direction: -1 | 1): void {
  if (id === 'all') return
  const store = read()
  const ids = listCategoryIds(store)
  const index = ids.indexOf(id)
  if (index < 0) return
  const target = index + direction
  if (target < 0 || target >= ids.length) return
  const next = [...ids]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  store.order = next
  write(store)
}

export function getTitleCategoryId(titleId: string, fallbackStatus?: string | null): string {
  const store = read()
  if (store.assignments[titleId]) return store.assignments[titleId]
  const visible = visibleBuiltin(store)
  if (fallbackStatus === 'completed') {
    if (visible.some((c) => c.id === 'finished')) return 'finished'
  }
  if (fallbackStatus) {
    const match = visible.find((c) => c.status === fallbackStatus)
    if (match) return match.id
  }
  if (visible.some((c) => c.id === 'reading')) return 'reading'
  return visible[0]?.id ?? store.custom[0]?.id ?? 'reading'
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
