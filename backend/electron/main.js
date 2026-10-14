const { app, BrowserWindow, shell, Tray, Menu } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const DEFAULT_LIVE_URL = 'https://resume.getchintu.com';
const isLiveMode = app.isPackaged || process.argv.includes('--live');
const SERVER_URL = process.env.APP_URL || (isLiveMode ? DEFAULT_LIVE_URL : `http://localhost:${PORT}`);
const isLocal = SERVER_URL.includes('localhost') || SERVER_URL.includes('127.0.0.1');

let mainWindow = null;
let tray = null;
let isQuitting = false;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });
}

function pollServer(url, timeoutMs = 45000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, () => {
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error(`Timed out waiting for server at ${url}`));
          return;
        }
        setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
}

function getTrayIconPath() {
  const icoPath = path.join(__dirname, 'icon.ico');
  if (fs.existsSync(icoPath)) {
    return icoPath;
  }
  return path.join(__dirname, 'icon.png');
}

function createTray() {
  if (tray) return;

  const iconPath = getTrayIconPath();
  tray = new Tray(iconPath);
  tray.setToolTip('Resume Tailor AI');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Resume Tailor AI',
      click: () => {
        showMainWindow();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    showMainWindow();
  });

  tray.on('double-click', () => {
    showMainWindow();
  });
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    title: 'Resume Tailor AI',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url).catch(() => {});
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  return win;
}

async function startApp() {
  mainWindow = createMainWindow();
  createTray();
  try {
    if (isLocal) {
      await pollServer(SERVER_URL);
    }
    await mainWindow.loadURL(SERVER_URL);
  } catch (err) {
    mainWindow.show();
    const errorHtml = `
      <body style="font-family:sans-serif;padding:32px;background:#111;color:#eee;">
        <h2>Server Connection Error</h2>
        <p>Could not connect to the local server at ${SERVER_URL}</p>
        <p>${err.message}</p>
      </body>
    `;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`).catch(() => {});
  }
}

app.whenReady().then(() => {
  if (gotTheLock) {
    startApp().catch(() => {});
  }

  app.on('activate', () => {
    if (mainWindow) {
      showMainWindow();
    } else if (BrowserWindow.getAllWindows().length === 0) {
      startApp().catch(() => {});
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
