import './styles.css'
import {
  createBackup,
  MAX_TEXT_LENGTH,
  mergeWishes,
  parseBackup,
  summarizeImport,
} from './data/backup.js'
import { repository } from './data/db.js'
import {
  formatDate,
  oneYearAgo,
  sortNewestFirst,
  toLocalDate,
} from './lib/date.js'

const element = (id) => document.getElementById(id)
const today = toLocalDate()
const state = {
  wishes: [],
  activePage: 'today',
  editingToday: false,
  selectedId: null,
  starFilter: 'all',
  yearFilter: 'all',
  pendingImport: null,
  settings: {
    twinkle: true,
    reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  },
}

let draftTimer
let toastTimer
let lastFocusedElement

function countCharacters(value) {
  return Array.from(value).length
}

function getTodayWish() {
  return state.wishes.find((wish) => wish.date === today)
}

function getSelectedWish() {
  return state.wishes.find((wish) => wish.id === state.selectedId)
}

function notify(message) {
  const toast = element('toast')
  toast.textContent = message
  toast.hidden = false
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.hidden = true
  }, 3200)
}

function reportError(error, fallback) {
  console.error(error)
  notify(error?.message || fallback)
}

function resizeInput() {
  const input = element('wishInput')
  input.style.height = 'auto'
  input.style.height = `${Math.max(118, Math.min(input.scrollHeight, 250))}px`
  input.style.overflowY = input.scrollHeight > 250 ? 'auto' : 'hidden'
  element('wishCount').textContent = `${countCharacters(input.value)} / ${MAX_TEXT_LENGTH}`
}

function renderToday() {
  const wish = getTodayWish()
  element('todayDate').textContent = formatDate(today)
  element('homeCount').textContent = state.wishes.length
  element('editorZone').hidden = Boolean(wish) && !state.editingToday
  element('savedWish').hidden = !wish || state.editingToday

  if (wish) {
    element('savedWishText').textContent = wish.text
    element('saveWishLabel').textContent = state.editingToday
      ? '更新这颗愿望星星'
      : '把愿望种进宇宙'
  } else {
    element('saveWishLabel').textContent = '把愿望种进宇宙'
  }
}

function seededNumber(value) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function makeStarButton(wish, index) {
  const seed = seededNumber(`${wish.date}-${wish.id}`)
  const button = document.createElement('button')
  button.className = `wish-star${wish.status === 'fulfilled' ? ' fulfilled' : ''}`
  button.type = 'button'
  button.setAttribute('aria-label', `${formatDate(wish.date)}：${wish.text}`)
  button.style.setProperty('--x', `${8 + ((seed + index * 31) % 84)}%`)
  button.style.setProperty('--y', `${8 + ((seed * 7 + index * 43) % 70)}%`)
  button.style.setProperty('--size', `${16 + (seed % 17)}px`)
  button.style.setProperty('--delay', `${(seed % 30) / 10}s`)
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 1.8 3 7 7.2 3.2-7.2 3.2-3 7-3-7L1.8 12 9 8.8Z" /></svg>'
  button.addEventListener('click', () => openDetail(wish.id))
  return button
}

function renderStars() {
  const filtered = sortNewestFirst(state.wishes).filter(
    (wish) => state.starFilter === 'all' || wish.status === state.starFilter,
  )
  const visible = filtered.slice(0, 80)
  const starPoints = element('starPoints')
  starPoints.replaceChildren()

  visible.forEach((wish, index) => {
    starPoints.append(makeStarButton(wish, index))
  })

  if (!visible.length) {
    const empty = document.createElement('div')
    empty.className = 'empty-state galaxy-empty'
    empty.innerHTML = '<span>✧</span><p>这片星空暂时安静着。<br />愿望慢慢来就好。</p>'
    starPoints.append(empty)
  }

  element('starCount').textContent = state.wishes.length
  element('fulfilledCount').textContent = state.wishes.filter(
    (wish) => wish.status === 'fulfilled',
  ).length
  element('mapNote').textContent =
    filtered.length > visible.length
      ? `星图展示最近 ${visible.length} 颗，全部愿望可在「时光回望」查看。`
      : ''

  document.querySelectorAll('#starFilters .filter').forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === state.starFilter)
  })
}

function makeTimelineItem(wish) {
  const button = document.createElement('button')
  button.className = 'timeline-item'
  button.type = 'button'
  button.innerHTML = `
    <span class="timeline-star">✦</span>
    <span class="timeline-copy">
      <time></time><strong></strong><small></small>
    </span>
  `
  button.querySelector('time').textContent = formatDate(wish.date)
  button.querySelector('strong').textContent = wish.text
  button.querySelector('small').textContent =
    wish.status === 'fulfilled' ? '✨ 这个愿望实现啦' : '✧ 仍在发光'
  button.addEventListener('click', () => openDetail(wish.id))
  return button
}

function renderMemories() {
  const anniversary = state.wishes.find(
    (wish) => wish.date === oneYearAgo(),
  )
  element('anniversaryDate').textContent = anniversary
    ? formatDate(anniversary.date)
    : '一年前的今天'
  element('anniversaryText').textContent = anniversary
    ? anniversary.text
    : '去年的今天还没有许愿。没关系，从今天开始收藏吧。'

  const years = [
    ...new Set(sortNewestFirst(state.wishes).map((wish) => wish.date.slice(0, 4))),
  ]
  if (state.yearFilter !== 'all' && !years.includes(state.yearFilter)) {
    state.yearFilter = 'all'
  }

  const yearFilters = element('yearFilters')
  yearFilters.replaceChildren()
  ;['all', ...years].forEach((year) => {
    const button = document.createElement('button')
    button.className = `filter${year === state.yearFilter ? ' active' : ''}`
    button.type = 'button'
    button.textContent = year === 'all' ? '所有年份' : `${year} 年`
    button.addEventListener('click', () => {
      state.yearFilter = year
      renderMemories()
    })
    yearFilters.append(button)
  })

  const wishes = sortNewestFirst(state.wishes).filter(
    (wish) =>
      state.yearFilter === 'all' || wish.date.startsWith(state.yearFilter),
  )
  const timeline = element('timeline')
  timeline.replaceChildren()
  wishes.forEach((wish) => timeline.append(makeTimelineItem(wish)))

  if (!wishes.length) {
    const empty = document.createElement('div')
    empty.className = 'empty-state'
    empty.innerHTML = '<span>✧</span><p>这里还没有旧日星光。</p>'
    timeline.append(empty)
  }
}

function applySettings() {
  const app = element('app')
  app.classList.toggle('no-twinkle', !state.settings.twinkle)
  app.classList.toggle('reduce-motion', state.settings.reduceMotion)
  element('twinkleSwitch').checked = state.settings.twinkle
  element('motionSwitch').checked = state.settings.reduceMotion
}

function renderAll() {
  state.wishes = sortNewestFirst(state.wishes)
  renderToday()
  renderStars()
  renderMemories()
  applySettings()
}

function switchPage(page) {
  if (!['today', 'stars', 'memories', 'settings'].includes(page)) return
  state.activePage = page
  ;['today', 'stars', 'memories', 'settings'].forEach((name) => {
    element(`page-${name}`).hidden = name !== page
  })
  document.querySelectorAll('[data-page-link]').forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.pageLink === page))
  })
  const use = element('settingsButton').querySelector('use')
  use.setAttribute('href', page === 'settings' ? '#icon-back' : '#icon-settings')
  element('settingsButton').setAttribute(
    'aria-label',
    page === 'settings' ? '返回今日许愿' : '打开设置与备份',
  )
  element('viewport').scrollTop = 0
}

async function saveDraft() {
  const text = element('wishInput').value
  if (!text.trim()) {
    await repository.deleteMeta('draft')
    element('draftStatus').textContent = '✦ 愿望不必很大'
    return
  }

  await repository.setMeta('draft', {
    date: today,
    text,
    editingId: state.editingToday ? getTodayWish()?.id : null,
    updatedAt: new Date().toISOString(),
  })
  element('draftStatus').textContent = '✓ 草稿已自动保存'
}

function scheduleDraftSave() {
  element('draftStatus').textContent = '正在保存草稿…'
  clearTimeout(draftTimer)
  draftTimer = window.setTimeout(() => {
    saveDraft().catch((error) => reportError(error, '草稿保存失败'))
  }, 450)
}

async function saveTodayWish() {
  const input = element('wishInput')
  const text = input.value.trim()
  if (!text) {
    notify('先写下一个小小的愿望吧 ✧')
    input.focus()
    return
  }
  if (countCharacters(text) > MAX_TEXT_LENGTH) {
    notify('每颗星星最多藏 300 个字。')
    return
  }

  const existing = getTodayWish()
  const now = new Date().toISOString()
  const wish = {
    id: existing?.id || `wish-${crypto.randomUUID()}`,
    date: today,
    text,
    status: existing?.status || 'pending',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }

  try {
    clearTimeout(draftTimer)
    await repository.saveWish(wish)
    await repository.deleteMeta('draft')
    const existingIndex = state.wishes.findIndex((item) => item.id === wish.id)
    if (existingIndex >= 0) state.wishes[existingIndex] = wish
    else state.wishes.push(wish)
    state.editingToday = false
    input.value = ''
    element('draftStatus').textContent = '✦ 愿望不必很大'
    resizeInput()
    renderAll()
    input.blur()
    launchStar()
    notify(
      existing
        ? '愿望重新写好了，宇宙一直记得 ✧'
        : '宇宙收到啦。今天又亮起一颗星 ✦',
    )
  } catch (error) {
    reportError(error, '愿望保存失败，请稍后重试')
  }
}

function launchStar() {
  if (state.settings.reduceMotion) return
  const source = element('saveWishButton').getBoundingClientRect()
  const target = element('arrivalStar').getBoundingClientRect()
  const star = document.createElement('span')
  star.className = 'flight-star'
  star.textContent = '✦'
  star.style.left = `${source.left + source.width / 2}px`
  star.style.top = `${source.top}px`
  document.body.append(star)

  const x = target.left - source.left - source.width / 2
  const y = target.top - source.top
  const animation = star.animate(
    [
      { transform: 'translate(-50%, 0) scale(.6)', opacity: 0 },
      { offset: 0.18, transform: 'translate(-50%, -35px) scale(1.35)', opacity: 1 },
      { transform: `translate(calc(-50% + ${x}px), ${y}px) scale(.1)`, opacity: 0 },
    ],
    { duration: 1450, easing: 'cubic-bezier(.35,.12,.25,1)', fill: 'forwards' },
  )
  animation.finished.catch(() => {}).finally(() => star.remove())
}

function openDetail(id) {
  const wish = state.wishes.find((item) => item.id === id)
  if (!wish) return
  state.selectedId = id
  lastFocusedElement = document.activeElement
  element('detailDate').textContent = `${formatDate(wish.date)} · 一颗愿望星星`
  element('detailText').textContent = wish.text
  element('detailTitle').textContent =
    wish.status === 'fulfilled' ? '已经实现的光' : '这一颗星，还在发光'
  element('detailStatus').textContent =
    wish.status === 'fulfilled'
      ? '✨ 你已经把这颗星星点亮了。'
      : '愿望不着急，慢慢生长就好。'
  element('fulfillButton').textContent =
    wish.status === 'fulfilled' ? '↶ 设为仍在期待' : '✦ 这个愿望实现啦'
  element('fulfillButton').classList.toggle(
    'fulfilled',
    wish.status === 'fulfilled',
  )
  element('detailMask').hidden = false
  element('detailSheet').focus()
}

function closeDetail() {
  element('detailMask').hidden = true
  state.selectedId = null
  lastFocusedElement?.focus()
}

async function toggleFulfilled() {
  const wish = getSelectedWish()
  if (!wish) return
  const updated = {
    ...wish,
    status: wish.status === 'fulfilled' ? 'pending' : 'fulfilled',
    updatedAt: new Date().toISOString(),
  }
  try {
    await repository.saveWish(updated)
    state.wishes = state.wishes.map((item) =>
      item.id === updated.id ? updated : item,
    )
    closeDetail()
    renderAll()
    notify(updated.status === 'fulfilled' ? '这颗愿望星星，更亮了 ✨' : '星星会继续陪着你 ✧')
  } catch (error) {
    reportError(error, '状态更新失败')
  }
}

async function deleteSelectedWish() {
  const wish = getSelectedWish()
  if (!wish) return
  if (!window.confirm('确定删除这颗星吗？删除后无法撤销。')) return

  try {
    await repository.deleteWish(wish.id)
    state.wishes = state.wishes.filter((item) => item.id !== wish.id)
    closeDetail()
    renderAll()
    notify('这颗星已从本机星空移除。')
  } catch (error) {
    reportError(error, '删除失败')
  }
}

function exportBackup() {
  const backup = createBackup(state.wishes)
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `wishstar-backup-${today}.json`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  notify('备份已生成，请确认文件已经保存。')
}

function askImportMode(summary) {
  const dialog = element('importDialog')
  element('importSummary').textContent = summary.conflicts
    ? `备份中有 ${summary.incoming} 颗星，其中 ${summary.conflicts} 天与本机重复。合并时会保留每一天更新较新的内容。`
    : `备份中有 ${summary.incoming} 颗星，与本机数据没有日期冲突。`

  if (typeof dialog.showModal !== 'function') {
    return Promise.resolve(
      window.confirm('选择“确定”合并星空；选择“取消”则不导入。')
        ? 'merge'
        : 'cancel',
    )
  }

  dialog.returnValue = 'cancel'
  dialog.showModal()
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue), {
      once: true,
    })
  })
}

async function importBackup(file) {
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    notify('备份文件不能超过 5MB。')
    return
  }

  try {
    const incoming = parseBackup(await file.text())
    const summary = summarizeImport(state.wishes, incoming)
    const mode = await askImportMode(summary)
    if (mode === 'cancel') return

    const nextWishes =
      mode === 'replace' ? incoming : mergeWishes(state.wishes, incoming)
    clearTimeout(draftTimer)
    await repository.replaceWishes(nextWishes)
    await repository.deleteMeta('draft')
    state.wishes = nextWishes
    state.editingToday = false
    element('wishInput').value = ''
    resizeInput()
    renderAll()
    switchPage('stars')
    notify(`已找回 ${incoming.length} 颗星星 ✧`)
  } catch (error) {
    reportError(error, '没能读取这份星空备份')
  }
}

async function saveSettings() {
  await repository.setMeta('settings', state.settings)
}

async function clearAllData() {
  const confirmed = window.confirm(
    '确定清空这台设备上的全部愿望和草稿吗？此操作无法撤销。',
  )
  if (!confirmed) return

  try {
    clearTimeout(draftTimer)
    await repository.clearAll()
    state.wishes = []
    state.editingToday = false
    state.settings = {
      twinkle: true,
      reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    }
    element('wishInput').value = ''
    element('draftStatus').textContent = '✦ 愿望不必很大'
    resizeInput()
    renderAll()
    switchPage('today')
    notify('本机星空已经清空。')
  } catch (error) {
    reportError(error, '数据清空失败')
  }
}

function wireEvents() {
  document.querySelectorAll('[data-page-link]').forEach((button) => {
    button.addEventListener('click', () => switchPage(button.dataset.pageLink))
  })
  element('settingsButton').addEventListener('click', () => {
    switchPage(state.activePage === 'settings' ? 'today' : 'settings')
  })
  element('wishInput').addEventListener('input', () => {
    resizeInput()
    scheduleDraftSave()
  })
  element('wishInput').addEventListener('focus', () => {
    window.setTimeout(
      () => element('wishInput').scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
      180,
    )
  })
  element('saveWishButton').addEventListener('click', saveTodayWish)
  element('editWishButton').addEventListener('click', () => {
    const wish = getTodayWish()
    if (!wish) return
    state.editingToday = true
    element('wishInput').value = wish.text
    renderToday()
    resizeInput()
    element('wishInput').focus()
  })
  element('findWishButton').addEventListener('click', () => {
    const wish = getTodayWish()
    switchPage('stars')
    if (wish) window.setTimeout(() => openDetail(wish.id), 220)
  })
  element('starFilters').addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]')
    if (!button) return
    state.starFilter = button.dataset.filter
    renderStars()
  })
  element('randomWishButton').addEventListener('click', () => {
    if (!state.wishes.length) {
      notify('先种下第一颗星星吧。')
      return
    }
    const previous = state.wishes.filter((wish) => wish.date !== today)
    const pool = previous.length ? previous : state.wishes
    openDetail(pool[Math.floor(Math.random() * pool.length)].id)
  })
  element('closeDetailButton').addEventListener('click', closeDetail)
  element('detailMask').addEventListener('click', (event) => {
    if (event.target === element('detailMask')) closeDetail()
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !element('detailMask').hidden) closeDetail()
  })
  element('fulfillButton').addEventListener('click', toggleFulfilled)
  element('deleteWishButton').addEventListener('click', deleteSelectedWish)
  element('exportButton').addEventListener('click', exportBackup)
  element('importButton').addEventListener('click', () => element('importFile').click())
  element('importFile').addEventListener('change', (event) => {
    importBackup(event.target.files?.[0])
    event.target.value = ''
  })
  element('twinkleSwitch').addEventListener('change', async (event) => {
    state.settings.twinkle = event.target.checked
    applySettings()
    try {
      await saveSettings()
    } catch (error) {
      reportError(error, '设置保存失败')
    }
  })
  element('motionSwitch').addEventListener('change', async (event) => {
    state.settings.reduceMotion = event.target.checked
    applySettings()
    try {
      await saveSettings()
    } catch (error) {
      reportError(error, '设置保存失败')
    }
  })
  element('clearButton').addEventListener('click', clearAllData)
}

async function restoreState() {
  const [wishes, settings, draft] = await Promise.all([
    repository.getAllWishes(),
    repository.getMeta('settings'),
    repository.getMeta('draft'),
  ])

  state.wishes = sortNewestFirst(wishes)
  if (settings && typeof settings === 'object') {
    state.settings.twinkle = settings.twinkle !== false
    state.settings.reduceMotion = Boolean(settings.reduceMotion)
  }

  if (draft?.date === today && typeof draft.text === 'string' && draft.text.trim()) {
    const todayWish = getTodayWish()
    if (!todayWish || draft.editingId === todayWish.id) {
      state.editingToday = Boolean(todayWish)
      element('wishInput').value = draft.text
      element('draftStatus').textContent = '✓ 已恢复上次的草稿'
    } else {
      await repository.deleteMeta('draft')
    }
  } else if (draft) {
    await repository.deleteMeta('draft')
  }
}

async function initialize() {
  wireEvents()
  try {
    await restoreState()
    resizeInput()
    renderAll()
    element('app').dataset.ready = 'true'
    element('loading').hidden = true
  } catch (error) {
    console.error(error)
    element('loading').innerHTML =
      '<span>✧</span><p>浏览器没能打开本机存储。<br />请关闭无痕模式或检查存储权限后刷新。</p>'
  }
}

initialize()
