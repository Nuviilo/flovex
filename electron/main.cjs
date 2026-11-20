const { app, BrowserWindow, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

let server = null;

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const httpServer = http.createServer((req, res) => {
      const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
      let pathname = decodeURIComponent(reqUrl.pathname);
      if (pathname === '/') pathname = '/index.html';

      const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
      let filePath = path.join(DIST_DIR, safePath);

      if (!filePath.startsWith(DIST_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST_DIR, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      });
      fs.createReadStream(filePath).pipe(res);
    });

    httpServer.on('error', reject);
    httpServer.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address();
      resolve({ httpServer, port: addr.port });
    });
  });
}

async function createWindow() {
  const started = await startStaticServer();
  server = started.httpServer;

  const mainWindow = new BrowserWindow({
    width: 960,
    height: 760,
    minWidth: 480,
    minHeight: 600,
    title: 'flovex',
    icon: path.join(__dirname, 'icons', 'icon.png'),
    autoHideMenuBar: true,
    backgroundColor: '#F7F8FA',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await mainWindow.loadURL(`http://127.0.0.1:${started.port}`);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (server) {
    server.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
