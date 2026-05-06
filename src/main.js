const { app, BrowserWindow, ipcMain, screen } = require('electron')
const path = require('path')

let mainWindow = null
let petWindow = null

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
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  petWindow = new BrowserWindow({
    width: 320,
    height: 400,
    x: Math.round((width - 320) / 2),
    y: Math.round((height - 400) / 2),
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
  petWindow.hide()

  // Pass through clicks on transparent areas
  petWindow.setIgnoreMouseEvents(true, { forward: true })
}

// ── IPC: show/hide/update pet window ─────────────────────────────────────────
ipcMain.on('show-pet', (_, data) => {
  if (!petWindow) return
  petWindow.setIgnoreMouseEvents(false)
  petWindow.showInactive()
  petWindow.webContents.send('trigger-pet', data)
})

ipcMain.on('hide-pet', () => {
  if (!petWindow) return
  petWindow.hide()
  petWindow.setIgnoreMouseEvents(true, { forward: true })
})

ipcMain.on('pet-area-enter', () => {
  if (petWindow) petWindow.setIgnoreMouseEvents(false)
})

ipcMain.on('pet-area-leave', () => {
  if (petWindow) petWindow.setIgnoreMouseEvents(true, { forward: true })
})

ipcMain.on('task-completed', () => {
  if (!petWindow) return
  petWindow.setIgnoreMouseEvents(false)
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
