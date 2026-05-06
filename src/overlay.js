// overlay.js — Pet animation + petting mechanic (renderer process)
const { ipcRenderer } = require('electron')

// ── Audio ─────────────────────────────────────────────────────────────────────
const sounds = {
  bark:    new Audio('../public/sounds/dog-barking.mp3'),
  whine:   new Audio('../public/sounds/dog-whining.mp3'),
  pant:    new Audio('../public/sounds/dog-panting.mp3'),
  happy:   new Audio('../public/sounds/puppy-happy.mp3'),
}

let pantInterval = null

function playSound(name) {
  const s = sounds[name]
  if (!s) return
  s.currentTime = 0
  s.play().catch(() => {})
}

function startPanting() {
  if (pantInterval) return
  playSound('pant')
  pantInterval = setInterval(() => playSound('pant'), 800)
}

function stopPanting() {
  clearInterval(pantInterval)
  pantInterval = null
}

// ── Animation management ──────────────────────────────────────────────────────
const ANIMATIONS = {
  sneaky:          '../public/animations/Flirting Dog.json',
  angry:           '../public/animations/Angry Dog.json',
  'tail-wag':      '../public/animations/Happy Dog.json',
  'rainbow-cap':   '../public/animations/Happy Unicorn Dog.json',
  'mouth-open':    '../public/animations/Smiling Dog.json',
  'sparkly-eyes':  '../public/animations/sparkly-eyes.json'
}

const container = document.getElementById('lottie-container')
let currentAnim = null
let angryPeriodMs = 60000
let angryTimer = null
let petProgress = 0
let isMouseDown = false
let currentMode = 'ambient' // 'ambient' | 'blocking' | 'celebrate'

function playAnimation(name, loop = true) {
  if (currentAnim) {
    currentAnim.destroy()
    currentAnim = null
  }
  currentAnim = lottie.loadAnimation({
    container,
    renderer: 'svg',
    loop,
    autoplay: true,
    path: ANIMATIONS[name]
  })
}

// ── Guilt messages ────────────────────────────────────────────────────────────
function getGuiltMessage(count) {
  if (count === 1) return 'Back to work! 🐾'
  if (count === 2) return 'Again? Really? 🐾'
  return `This is the ${count}th time today... 🐾`
}

function showGuiltMsg(count) {
  const el = document.getElementById('guilt-msg')
  el.textContent = getGuiltMessage(count)
  el.classList.add('visible')
}

function hideGuiltMsg() {
  document.getElementById('guilt-msg').classList.remove('visible')
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function updateProgressBar(ratio) {
  document.getElementById('pet-progress-fill').style.width = (ratio * 100) + '%'
}

function showProgressBar() {
  document.getElementById('pet-progress-wrap').classList.add('visible')
}

function hideProgressBar() {
  document.getElementById('pet-progress-wrap').classList.remove('visible')
  updateProgressBar(0)
}

// ── Petting mechanic ──────────────────────────────────────────────────────────
function resetPetting() {
  petProgress = 0
  updateProgressBar(0)
}

function onPettingComplete() {
  stopPanting()
  clearTimeout(angryTimer)
  resetPetting()
  isMouseDown = false
  hideProgressBar()
  hideGuiltMsg()
  playSound('happy')

  playAnimation('tail-wag', false)
  currentAnim.addEventListener('complete', () => {
    ipcRenderer.send('go-ambient')
  })
}

container.addEventListener('mousedown', () => {
  if (currentMode !== 'blocking') return
  isMouseDown = true
  showProgressBar()
  startPanting()
})

document.addEventListener('mouseup', () => {
  if (isMouseDown) stopPanting()
  isMouseDown = false
})

container.addEventListener('mousemove', (e) => {
  if (!isMouseDown || currentMode !== 'blocking') return

  if (Math.abs(e.movementX) > 2 && Math.abs(e.movementY) < 6) {
    petProgress += Math.abs(e.movementX)
    updateProgressBar(Math.min(petProgress / 100, 1))
  }

  if (petProgress >= 100) {
    petProgress = 0
    onPettingComplete()
  }
})

container.addEventListener('mouseenter', () => {
  if (currentMode === 'blocking') ipcRenderer.send('pet-area-enter')
})
container.addEventListener('mouseleave', () => {
  ipcRenderer.send('pet-area-leave')
})

// ── IPC: ambient mode ─────────────────────────────────────────────────────────
ipcRenderer.on('go-ambient', () => {
  currentMode = 'ambient'
  clearTimeout(angryTimer)
  hideGuiltMsg()
  hideProgressBar()
  resetPetting()
  playAnimation('mouth-open')
})

// ── IPC: trigger blocking mode ────────────────────────────────────────────────
ipcRenderer.on('trigger-pet', (_, data) => {
  const { count } = data
  currentMode = 'blocking'
  resetPetting()
  hideGuiltMsg()
  hideProgressBar()

  playAnimation('sneaky')
  playSound('bark')
  showGuiltMsg(count)

  clearTimeout(angryTimer)
  angryTimer = setTimeout(() => {
    if (currentMode === 'blocking') {
      playAnimation('angry')
      playSound('whine')
    }
  }, angryPeriodMs)
})

// ── IPC: user returned to work ────────────────────────────────────────────────
ipcRenderer.on('user-returned', () => {
  currentMode = 'celebrate'
  clearTimeout(angryTimer)
  hideGuiltMsg()
  hideProgressBar()
  playSound('happy')

  playAnimation('sparkly-eyes', false)
  currentAnim.addEventListener('complete', () => {
    ipcRenderer.send('go-ambient')
  })

  // Fallback in case animation has no end
  setTimeout(() => {
    if (currentMode === 'celebrate') ipcRenderer.send('go-ambient')
  }, 3000)
})

// ── IPC: celebration (task completed) ────────────────────────────────────────
ipcRenderer.on('celebrate', () => {
  currentMode = 'celebrate'
  clearTimeout(angryTimer)
  hideGuiltMsg()
  hideProgressBar()
  playSound('happy')

  playAnimation('rainbow-cap', false)
  currentAnim.addEventListener('complete', () => {
    ipcRenderer.send('go-ambient')
  })

  setTimeout(() => {
    if (currentMode === 'celebrate') ipcRenderer.send('go-ambient')
  }, 3000)
})

// ── IPC: update angry period ──────────────────────────────────────────────────
ipcRenderer.on('update-angry-period', (_, ms) => {
  angryPeriodMs = ms
})
