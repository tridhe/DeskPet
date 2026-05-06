const { app, BrowserWindow, ipcMain, screen } = require('electron')
const path = require('path')

let mainWindow = null
let petWindow = null

const PET_W = 220
const PET_H = 240

function petX() {
  const { width } = screen.getPrimaryDisplay().workAreaSize
  return width - PET_W - 12
}

// ── Create main task-list window ──────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 620,
    resizable: false,
    title: 'DeskPet',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  mainWindow.loadFile(path.join(__dirname, '../public/app.html'))
  mainWindow.webContents.openDevTools({ mode: 'detach' })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ── Create always-on-top pet overlay window ───────────────────────────────────
function createPetWindow() {
  petWindow = new BrowserWindow({
    width: PET_W,
    height: PET_H,
    x: petX(),
    y: 12,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    type: 'panel',
    focusable: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  petWindow.setAlwaysOnTop(true, 'screen-saver')
  petWindow.loadFile(path.join(__dirname, '../public/overlay.html'))

  // Start in ambient mode once loaded
  petWindow.webContents.once('did-finish-load', () => {
    petWindow.showInactive()
    petWindow.setIgnoreMouseEvents(true, { forward: true })
    petWindow.webContents.send('go-ambient')
  })
}

// ── IPC: show/hide/update pet window ─────────────────────────────────────────
ipcMain.on('show-pet', (_, data) => {
  if (!petWindow) return
  petWindow.setIgnoreMouseEvents(false)
  petWindow.showInactive()
  petWindow.webContents.send('trigger-pet', data)
})

ipcMain.on('go-ambient', () => {
  if (!petWindow) return
  petWindow.setIgnoreMouseEvents(true, { forward: true })
  petWindow.webContents.send('go-ambient')
})

ipcMain.on('pet-area-enter', () => {
  if (petWindow) petWindow.setIgnoreMouseEvents(false)
})

ipcMain.on('pet-area-leave', () => {
  if (petWindow) petWindow.setIgnoreMouseEvents(true, { forward: true })
})

ipcMain.on('update-angry-period', (_, ms) => {
  if (petWindow) petWindow.webContents.send('update-angry-period', ms)
})

ipcMain.on('user-returned', () => {
  if (!petWindow) return
  petWindow.setIgnoreMouseEvents(true, { forward: true })
  petWindow.webContents.send('user-returned')
})

ipcMain.on('task-completed', () => {
  if (!petWindow) return
  petWindow.setIgnoreMouseEvents(true, { forward: true })
  petWindow.showInactive()
  petWindow.webContents.send('celebrate')
})

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createMainWindow()
  createPetWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (!mainWindow) createMainWindow()
})
