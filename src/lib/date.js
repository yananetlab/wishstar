export function toLocalDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isValidLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day, 12)

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  )
}

export function formatDate(value) {
  return value.replaceAll('-', '.')
}

export function oneYearAgo(value = new Date()) {
  const date = new Date(value)
  date.setFullYear(date.getFullYear() - 1)
  return toLocalDate(date)
}

export function sortNewestFirst(wishes) {
  return [...wishes].sort((first, second) =>
    second.date.localeCompare(first.date),
  )
}
