// overlay.js — Pet animation + petting mechanic (renderer process)
const { ipcRenderer } = require('electron')

// ── Animation management ──────────────────────────────────────────────────────
const ANIMATIONS = {
  sneaky:        '../public/animations/Flirting Dog.json',
  angry:         '../public/animations/Angry Dog.json',
  'tail-wag':    '../public/animations/Happy Dog.json',
  'rainbow-cap': '../public/animations/Happy Unicorn Dog.json',
  'mouth-open':  '../public/animations/Smiling Dog.json',
  'sparkly-eyes':'../public/animations/sparkly-eyes.json'
}

const container = document.getElementById('lottie-container')
let currentAnim = null
let angryTimer = null
let petProgress = 0
let isMouseDown = false
let currentMode = 'idle' // 'idle' | 'blocking' | 'celebrate'

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
  clearTimeout(angryTimer)
  resetPetting()
  isMouseDown = false
  hideProgressBar()
  hideGuiltMsg()
  currentMode = 'idle'

  playAnimation('tail-wag', false)
  currentAnim.addEventListener('complete', () => {
    ipcRenderer.send('hide-pet')
  })
}

container.addEventListener('mousedown', () => {
  if (currentMode !== 'blocking') return
  isMouseDown = true
  showProgressBar()
})

document.addEventListener('mouseup', () => {
  isMouseDown = false
})

container.addEventListener('mousemove', (e) => {
  if (!isMouseDown || currentMode !== 'blocking') return

  const isHorizontal = Math.abs(e.movementX) > 2 && Math.abs(e.movementY) < 6
  if (isHorizontal) {
    petProgress += Math.abs(e.movementX)
    updateProgressBar(Math.min(petProgress / 300, 1))
  }

  if (petProgress >= 300) {
    petProgress = 0
    onPettingComplete()
  }
})

// Notify main process to enable mouse events over the dog
container.addEventListener('mouseenter', () => {
  ipcRenderer.send('pet-area-enter')
})
container.addEventListener('mouseleave', () => {
  ipcRenderer.send('pet-area-leave')
})

// ── IPC: trigger the pet overlay ──────────────────────────────────────────────
ipcRenderer.on('trigger-pet', (_, data) => {
  const { count } = data
  currentMode = 'blocking'
  resetPetting()
  hideGuiltMsg()
  hideProgressBar()

  // First animation: sneaky. Escalate to angry if ignored for 60s.
  playAnimation('sneaky')
  showGuiltMsg(count)

  clearTimeout(angryTimer)
  angryTimer = setTimeout(() => {
    if (currentMode === 'blocking') {
      playAnimation('angry')
    }
  }, 60000)
})

// ── IPC: celebration (task completed) ────────────────────────────────────────
ipcRenderer.on('celebrate', () => {
  currentMode = 'celebrate'
  clearTimeout(angryTimer)
  hideGuiltMsg()
  hideProgressBar()

  playAnimation('rainbow-cap', false)

  currentAnim.addEventListener('complete', () => {
    ipcRenderer.send('hide-pet')
    currentMode = 'idle'
  })

  // Auto-dismiss after 3 seconds regardless
  setTimeout(() => {
    if (currentMode === 'celebrate') {
      ipcRenderer.send('hide-pet')
      currentMode = 'idle'
    }
  }, 3000)
})
