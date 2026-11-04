export interface ReaderShortcut {
  keys: string[]
  action: string
  group: 'Navigate' | 'View' | 'Reader'
}

export const READER_SHORTCUTS: ReaderShortcut[] = [
  { group: 'Navigate', keys: ['←', '→'], action: 'Previous / next page (or spread)' },
  { group: 'Navigate', keys: ['Space', 'PgDn'], action: 'Next page / scroll down' },
  { group: 'Navigate', keys: ['PgUp'], action: 'Previous page / scroll up' },
  { group: 'Navigate', keys: ['Home', 'End'], action: 'First / last page' },
  { group: 'View', keys: ['+', '−'], action: 'Zoom in / out' },
  { group: 'View', keys: ['F', 'F11'], action: 'Toggle fullscreen' },
  { group: 'Reader', keys: [','], action: 'Open reader settings' },
  { group: 'Reader', keys: ['?'], action: 'Show / hide this cheatsheet' },
  { group: 'Reader', keys: ['Esc'], action: 'Close overlay / exit fullscreen / leave reader' },
]

export const READER_SHORTCUT_GROUPS = ['Navigate', 'View', 'Reader'] as const

export function shortcutsByGroup(
  group: (typeof READER_SHORTCUT_GROUPS)[number],
): ReaderShortcut[] {
  return READER_SHORTCUTS.filter((item) => item.group === group)
}
