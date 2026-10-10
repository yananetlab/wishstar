import { isValidLocalDate, sortNewestFirst } from '../lib/date.js'

export const BACKUP_FORMAT = 'wishstar-backup'
export const BACKUP_SCHEMA_VERSION = 1
export const MAX_WISHES = 5000
export const MAX_TEXT_LENGTH = 300

const LEGACY_FORMAT = 'wishstar-demo-backup'

function countCharacters(value) {
  return Array.from(value).length
}

function normalizeTimestamp(value, fallback) {
  if (typeof value !== 'string') return fallback
  return Number.isFinite(Date.parse(value)) ? value : fallback
}

export function normalizeWish(value, now = new Date().toISOString()) {
  if (!value || typeof value !== 'object') {
    throw new Error('备份中存在无法识别的愿望')
  }

  const text = typeof value.text === 'string' ? value.text.trim() : ''
  const date = value.date
  const status = value.status

  if (!isValidLocalDate(date)) throw new Error('备份中存在无效日期')
  if (!text || countCharacters(text) > MAX_TEXT_LENGTH) {
    throw new Error('愿望内容为空或超过 300 字')
  }
  if (!['pending', 'fulfilled'].includes(status)) {
    throw new Error('备份中存在无效状态')
  }

  const createdAt = normalizeTimestamp(value.createdAt, now)

  const generatedId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`

  return {
    id:
      typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 120
        ? value.id
        : `wish-${generatedId}`,
    date,
    text,
    status,
    createdAt,
    updatedAt: normalizeTimestamp(value.updatedAt, createdAt),
  }
}

export function createBackup(wishes) {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    wishes: sortNewestFirst(wishes).map((wish) => ({ ...wish })),
  }
}

export function parseBackup(text) {
  let data

  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('文件不是有效的 JSON')
  }

  const supportedFormat =
    data?.format === BACKUP_FORMAT || data?.format === LEGACY_FORMAT

  if (
    !supportedFormat ||
    data?.schemaVersion !== BACKUP_SCHEMA_VERSION ||
    !Array.isArray(data?.wishes)
  ) {
    throw new Error('这不是 Wishstar 备份文件')
  }

  if (data.wishes.length > MAX_WISHES) {
    throw new Error(`备份最多可包含 ${MAX_WISHES} 颗星星`)
  }

  const dates = new Set()
  const ids = new Set()
  const wishes = data.wishes.map((wish) => {
    const normalized = normalizeWish(wish)
    if (dates.has(normalized.date)) {
      throw new Error('备份中同一天存在多个愿望')
    }
    if (ids.has(normalized.id)) {
      throw new Error('备份中存在重复的愿望记录')
    }
    dates.add(normalized.date)
    ids.add(normalized.id)
    return normalized
  })

  return sortNewestFirst(wishes)
}

export function mergeWishes(current, incoming) {
  const byDate = new Map(current.map((wish) => [wish.date, wish]))

  incoming.forEach((wish) => {
    const existing = byDate.get(wish.date)
    if (!existing || Date.parse(wish.updatedAt) >= Date.parse(existing.updatedAt)) {
      byDate.set(wish.date, wish)
    }
  })

  return sortNewestFirst([...byDate.values()])
}

export function summarizeImport(current, incoming) {
  const currentDates = new Set(current.map((wish) => wish.date))
  const conflicts = incoming.filter((wish) => currentDates.has(wish.date)).length

  return {
    incoming: incoming.length,
    conflicts,
    additions: incoming.length - conflicts,
  }
}
