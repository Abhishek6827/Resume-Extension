const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');

const PORT = process.env.PORT || 3000;
const DEFAULT_LIVE_URL = 'https://resume.getchintu.com';
const isLiveMode = app.isPackaged || process.argv.includes('--live');
const SERVER_URL = process.env.APP_URL || (isLiveMode ? DEFAULT_LIVE_URL : `http://localhost:${PORT}`);
const isLocal = SERVER_URL.includes('localhost') || SERVER_URL.includes('127.0.0.1');

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

  return win;
}

async function startApp() {
  const win = createMainWindow();
  try {
    if (isLocal) {
      await pollServer(SERVER_URL);
    }
    await win.loadURL(SERVER_URL);
  } catch (err) {
    win.show();
    const errorHtml = `
      <body style="font-family:sans-serif;padding:32px;background:#111;color:#eee;">
        <h2>Server Connection Error</h2>
        <p>Could not connect to the local server at ${SERVER_URL}</p>
        <p>${err.message}</p>
      </body>
    `;
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`).catch(() => {});
  }
}

app.whenReady().then(() => {
  startApp().catch(() => {});

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      startApp().catch(() => {});
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
