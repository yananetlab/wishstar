import { describe, expect, it } from 'vitest'
import { isValidLocalDate, toLocalDate } from '../src/lib/date.js'

describe('local date helpers', () => {
  it('formats a local calendar date', () => {
    expect(toLocalDate(new Date(2026, 9, 10, 23, 30))).toBe('2026-10-10')
  })

  it('validates real calendar dates', () => {
    expect(isValidLocalDate('2024-02-29')).toBe(true)
    expect(isValidLocalDate('2025-02-29')).toBe(false)
    expect(isValidLocalDate('2026-13-01')).toBe(false)
  })
})
