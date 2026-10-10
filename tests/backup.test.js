import { describe, expect, it } from 'vitest'
import {
  createBackup,
  mergeWishes,
  parseBackup,
  summarizeImport,
} from '../src/data/backup.js'

const wish = (overrides = {}) => ({
  id: 'wish-1',
  date: '2026-10-10',
  text: '希望今晚睡个好觉。',
  status: 'pending',
  createdAt: '2026-10-10T10:00:00.000Z',
  updatedAt: '2026-10-10T10:00:00.000Z',
  ...overrides,
})

describe('Wishstar backup', () => {
  it('round-trips a valid backup', () => {
    const backup = createBackup([wish()])
    expect(parseBackup(JSON.stringify(backup))).toEqual([wish()])
  })

  it('rejects duplicate wish dates', () => {
    const backup = createBackup([
      wish(),
      wish({ id: 'wish-2', text: '另一个愿望' }),
    ])
    expect(() => parseBackup(JSON.stringify(backup))).toThrow('同一天')
  })

  it('rejects duplicate record ids', () => {
    const backup = createBackup([
      wish(),
      wish({ date: '2026-10-09', text: '另一天的愿望' }),
    ])
    expect(() => parseBackup(JSON.stringify(backup))).toThrow('重复的愿望记录')
  })

  it('keeps the newer record while merging', () => {
    const current = [wish()]
    const incoming = [
      wish({
        id: 'wish-from-backup',
        text: '更新后的愿望',
        updatedAt: '2026-10-10T12:00:00.000Z',
      }),
      wish({ id: 'wish-2', date: '2026-10-09' }),
    ]

    const merged = mergeWishes(current, incoming)
    expect(merged).toHaveLength(2)
    expect(merged[0].text).toBe('更新后的愿望')
    expect(summarizeImport(current, incoming)).toEqual({
      incoming: 2,
      conflicts: 1,
      additions: 1,
    })
  })
})
