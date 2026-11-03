import { createContext, useContext, type ReactNode } from 'react'

interface SearchUiContextValue {
  openSearch: () => void
}

const SearchUiContext = createContext<SearchUiContextValue | null>(null)

export function SearchUiProvider({
  openSearch,
  children,
}: {
  openSearch: () => void
  children: ReactNode
}) {
  return (
    <SearchUiContext.Provider value={{ openSearch }}>{children}</SearchUiContext.Provider>
  )
}

export function useSearchUi() {
  return useContext(SearchUiContext)
}
