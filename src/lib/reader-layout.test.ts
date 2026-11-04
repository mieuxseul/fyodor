import { beforeEach, describe, expect, it } from 'vitest'

import {
  edgePaddingStyle,
  getEdgePaddingPreset,
  normalizeReadingMode,
  pageRangeLabel,
  pageStepForMode,
  setEdgePaddingPreset,
} from '@/lib/reader-layout'

describe('reader-layout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults edge padding to medium', () => {
    expect(getEdgePaddingPreset()).toBe('medium')
    expect(edgePaddingStyle('medium').maxWidth).toBe('920px')
  })

  it('persists edge padding presets', () => {
    expect(setEdgePaddingPreset('wide')).toBe('wide')
    expect(getEdgePaddingPreset()).toBe('wide')
    expect(edgePaddingStyle('none').padXPx).toBe(0)
  })

  it('steps two pages in double mode', () => {
    expect(pageStepForMode('page')).toBe(1)
    expect(pageStepForMode('vertical')).toBe(1)
    expect(pageStepForMode('double')).toBe(2)
  })

  it('formats double-page range labels', () => {
    expect(pageRangeLabel(0, 0, 'page')).toBe('0 / 0')
    expect(pageRangeLabel(2, 10, 'page')).toBe('3 / 10')
    expect(pageRangeLabel(2, 10, 'double')).toBe('3–4 / 10')
    expect(pageRangeLabel(9, 10, 'double')).toBe('10 / 10')
  })

  it('normalizes reading modes', () => {
    expect(normalizeReadingMode('double')).toBe('double')
    expect(normalizeReadingMode('vertical')).toBe('vertical')
    expect(normalizeReadingMode('weird')).toBe('page')
  })
})
