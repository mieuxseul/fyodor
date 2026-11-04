import { beforeEach, describe, expect, it } from 'vitest'

import {
  filterPublicHistory,
  isIncognitoSession,
  isTitlePrivate,
  setIncognitoSession,
  setTitlePrivate,
  shouldSuppressActivity,
} from '@/lib/incognito'

describe('incognito', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('marks titles private across related ids', () => {
    setTitlePrivate(true, 'title-1', 'edition-a')
    expect(isTitlePrivate('title-1')).toBe(true)
    expect(isTitlePrivate('edition-a')).toBe(true)
    expect(isTitlePrivate('other')).toBe(false)
    setTitlePrivate(false, 'title-1', 'edition-a')
    expect(isTitlePrivate('title-1')).toBe(false)
  })

  it('enables a session-wide incognito mode', () => {
    expect(isIncognitoSession()).toBe(false)
    setIncognitoSession(true)
    expect(isIncognitoSession()).toBe(true)
    expect(shouldSuppressActivity('anything')).toBe(true)
    setIncognitoSession(false)
    expect(shouldSuppressActivity('anything')).toBe(false)
  })

  it('filters private titles out of history lists', () => {
    setTitlePrivate(true, 'secret')
    const items = [
      { title: { id: 'secret' }, edition: { id: 'e1' } },
      { title: { id: 'public' }, edition: { id: 'e2' } },
    ]
    expect(filterPublicHistory(items)).toEqual([
      { title: { id: 'public' }, edition: { id: 'e2' } },
    ])
  })
})
