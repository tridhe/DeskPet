// app.js — Task list UI + distraction detection (renderer process)
console.log('app.js loaded ✓')
const { ipcRenderer, shell } = require('electron')

// ── State ─────────────────────────────────────────────────────────────────────
let tasks = JSON.parse(localStorage.getItem('deskpet-tasks') || '[]')
let distractionCount = parseInt(localStorage.getItem('deskpet-count') || '0')
let wastedSeconds = parseInt(localStorage.getItem('deskpet-wasted') || '0')
let distractionTimer = null
let wastedInterval = null
let lastCountDate = localStorage.getItem('deskpet-date') || ''
const activeWin = require('active-win')

// Reset daily counters at midnight
const today = new Date().toDateString()
if (lastCountDate !== today) {
  distractionCount = 0
  wastedSeconds = 0
  localStorage.setItem('deskpet-count', '0')
  localStorage.setItem('deskpet-wasted', '0')
  localStorage.setItem('deskpet-date', today)
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
function saveTasks() {
  localStorage.setItem('deskpet-tasks', JSON.stringify(tasks))
}

function updateStats() {
  document.getElementById('caught-count').textContent = distractionCount
  const mins = Math.round(wastedSeconds / 60)
  document.getElementById('wasted-time').textContent = mins + ' min'
  localStorage.setItem('deskpet-count', distractionCount)
  localStorage.setItem('deskpet-wasted', wastedSeconds)
}

function isOverdue(timeStr) {
  if (!timeStr) return false
  const [h, m] = timeStr.split(':').map(Number)
  const now = new Date()
  return now.getHours() > h || (now.getHours() === h && now.getMinutes() > m)
}

function renderTasks() {
  const list = document.getElementById('task-list')
  const empty = document.getElementById('empty-state')

  // Remove all task items but keep the empty-state element
  Array.from(list.children).forEach(child => {
    if (child.id !== 'empty-state') child.remove()
  })

  if (tasks.length === 0) {
    empty.style.display = 'block'
    return
  }

  empty.style.display = 'none'

  tasks.forEach((task, i) => {
    const div = document.createElement('div')
    div.className = 'task-item' + (task.done ? ' done' : '')

    const overdue = !task.done && isOverdue(task.time)

    div.innerHTML = `
      <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleTask(${i})" />
      <span class="task-name">${escapeHtml(task.name)}</span>
      ${task.time ? `<span class="task-deadline ${overdue ? 'overdue' : ''}">${task.time}${overdue ? ' !' : ''}</span>` : ''}
      <button class="delete-btn" onclick="deleteTask(${i})">×</button>
    `
    list.appendChild(div)
  })
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

// ── Task actions ──────────────────────────────────────────────────────────────
function addTask() {
  const input = document.getElementById('task-input')
  const timeInput = document.getElementById('task-time')
  const name = input.value.trim()
  if (!name) return

  tasks.push({ name, time: timeInput.value, done: false })
  saveTasks()
  renderTasks()
  input.value = ''
  timeInput.value = ''
  input.focus()
}

function toggleTask(i) {
  tasks[i].done = !tasks[i].done
  saveTasks()
  renderTasks()
  if (tasks[i].done) {
    ipcRenderer.send('task-completed')
  }
}

function deleteTask(i) {
  tasks.splice(i, 1)
  saveTasks()
  renderTasks()
}

document.getElementById('task-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTask()
})

// ── Summary modal ─────────────────────────────────────────────────────────────
function showSummary() {
  const done = tasks.filter(t => t.done).length
  const total = tasks.length
  const mins = Math.round(wastedSeconds / 60)

  document.getElementById('summary-tasks').textContent =
    `Tasks: ${done} / ${total} completed`
  document.getElementById('summary-wasted').textContent =
    `Time wasted: ${mins} minute${mins !== 1 ? 's' : ''}`
  document.getElementById('summary-caught').textContent =
    `Caught procrastinating: ${distractionCount} time${distractionCount !== 1 ? 's' : ''}`

  const msgs = [
    'Good dog owner! Almost as focused as a Shiba.',
    'The dog is... mildly disappointed.',
    'The dog needs a raise for putting up with you.',
    'You owe the dog extra treats.'
  ]
  const msgIdx = Math.min(Math.floor(distractionCount / 2), msgs.length - 1)
  document.getElementById('summary-msg').textContent = `"${msgs[msgIdx]}"`

  document.getElementById('modal-overlay').classList.add('visible')
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('visible')
}

// ── macOS permission helper ───────────────────────────────────────────────────
function openPrivacySettings() {
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
}

// ── No-Go List ────────────────────────────────────────────────────────────────
const DEFAULT_NOGO = [
  'youtube', 'reddit', 'twitter', 'x.com', 'instagram',
  'tiktok', 'netflix', 'twitch', 'facebook', 'spotify', 'discord'
]

function loadNoGoList() {
  const saved = localStorage.getItem('deskpet-nogo')
  return saved ? JSON.parse(saved) : [...DEFAULT_NOGO]
}

function saveNoGoList(list) {
  localStorage.setItem('deskpet-nogo', JSON.stringify(list))
}

function renderNoGoTags() {
  const list = loadNoGoList()
  const container = document.getElementById('nogo-tags')
  container.innerHTML = ''
  list.forEach((item, i) => {
    const tag = document.createElement('div')
    tag.className = 'nogo-tag'
    tag.innerHTML = `<span>${escapeHtml(item)}</span><button onclick="removeNoGoItem(${i})">×</button>`
    container.appendChild(tag)
  })
}

function addNoGoItem() {
  const input = document.getElementById('nogo-input')
  const value = input.value.trim().toLowerCase()
  if (!value) return
  const list = loadNoGoList()
  if (!list.includes(value)) {
    list.push(value)
    saveNoGoList(list)
    renderNoGoTags()
  }
  input.value = ''
  input.focus()
}

function removeNoGoItem(i) {
  const list = loadNoGoList()
  list.splice(i, 1)
  saveNoGoList(list)
  renderNoGoTags()
}

function toggleNoGoList() {
  const toggle = document.getElementById('nogo-toggle')
  const body = document.getElementById('nogo-body')
  toggle.classList.toggle('open')
  body.classList.toggle('visible')
}

document.getElementById('nogo-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addNoGoItem()
})

// ── Distraction detection ─────────────────────────────────────────────────────
function isDistraction(winInfo) {
  if (!winInfo) return false
  const title = (winInfo.title || '').toLowerCase()
  const url = (winInfo.url || '').toLowerCase()
  const appName = (winInfo.owner?.name || '').toLowerCase()
  const haystack = title + ' ' + url + ' ' + appName

  const isBrowser = ['chrome', 'safari', 'firefox', 'arc'].some(b => appName.includes(b))
  const noGoList = loadNoGoList()

  if (isBrowser) {
    if (noGoList.some(kw => (title + ' ' + url).includes(kw))) return true
  } else {
    if (noGoList.some(kw => appName.includes(kw))) return true
  }

  return false
}

function startWastedTimer() {
  if (wastedInterval) return
  wastedInterval = setInterval(() => {
    wastedSeconds++
    updateStats()
  }, 1000)
}

function stopWastedTimer() {
  clearInterval(wastedInterval)
  wastedInterval = null
}

function triggerPet() {
  console.log('triggerPet fired!')
  distractionCount++
  updateStats()
  ipcRenderer.send('show-pet', { count: distractionCount })
}

function startDetection() {
  setInterval(async () => {
    try {
      const win = await activeWin()
      // If we got a result, permission is working — hide the banner
      document.getElementById('perm-banner').classList.remove('visible')

      const distracted = isDistraction(win)
      console.log('active-win:', win?.owner?.name, '|', win?.title, '| url:', win?.url, '| distraction:', distracted)

      if (distracted) {
        startWastedTimer()
        if (!distractionTimer) {
          console.log('starting 3s timer...')
          distractionTimer = setTimeout(triggerPet, 30000)
        }
      } else {
        if (distractionTimer) console.log('timer cleared — not distracting')
        stopWastedTimer()
        clearTimeout(distractionTimer)
        distractionTimer = null
      }
    } catch (e) {
      console.error('active-win error:', e.message)
      document.getElementById('perm-banner').classList.add('visible')
    }
  }, 5000)
}

// ── Init ──────────────────────────────────────────────────────────────────────
renderTasks()
updateStats()
renderNoGoTags()
startDetection()

// Debug: Cmd+Shift+D triggers dog immediately, Cmd+Shift+C triggers celebration
document.addEventListener('keydown', (e) => {
  if (e.metaKey && e.shiftKey && e.key === 'D') triggerPet()
  if (e.metaKey && e.shiftKey && e.key === 'C') ipcRenderer.send('task-completed')
})
