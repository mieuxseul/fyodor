import { describe, expect, it } from 'vitest'

import {
  READER_SHORTCUTS,
  READER_SHORTCUT_GROUPS,
  shortcutsByGroup,
} from '@/lib/reader-shortcuts'

describe('reader-shortcuts', () => {
  it('lists every documented shortcut group', () => {
    for (const group of READER_SHORTCUT_GROUPS) {
      expect(shortcutsByGroup(group).length).toBeGreaterThan(0)
    }
  })

  it('includes cheatsheet and zoom bindings', () => {
    const blob = READER_SHORTCUTS.flatMap((item) => item.keys).join(' ')
    expect(blob).toContain('?')
    expect(blob).toContain('+')
    expect(blob).toContain('F')
    expect(blob).toContain(',')
  })
})
