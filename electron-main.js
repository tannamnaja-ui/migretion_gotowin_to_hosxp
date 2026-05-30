const { app, Tray, Menu, shell, nativeImage, dialog, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

const PORT = 3004;
const dataDir = app.getPath('userData');
const logFile = path.join(dataDir, 'startup.log');

// สร้าง userData directory ถ้ายังไม่มี
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function log(msg) {
  const line = `${new Date().toISOString()} ${msg}\n`;
  try { fs.appendFileSync(logFile, line); } catch (e) {}
  console.log(msg);
}

process.env.APP_DATA_DIR = dataDir;
log(`App starting — dataDir: ${dataDir}`);
log(`isPackaged: ${app.isPackaged}`);
log(`resourcesPath: ${process.resourcesPath}`);

let tray = null;

function waitForServer(callback, retries = 40) {
  http.get(`http://localhost:${PORT}`, () => {
    log('Server is ready');
    callback();
  }).on('error', () => {
    if (retries > 0) {
      setTimeout(() => waitForServer(callback, retries - 1), 500);
    } else {
      log('Server did not start in time');
      dialog.showErrorBox('ไม่สามารถเชื่อมต่อ server',
        `Server ไม่ตอบสนองที่ port ${PORT}\nดู log ที่: ${logFile}`);
    }
  });
}

// สร้าง icon จาก base64 สีน้ำเงิน 16x16 (fallback ถ้าไฟล์ icon ไม่มี)
function getDefaultIcon() {
  // PNG 16x16 สีน้ำเงิน (base64)
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAAO0lEQVQ4jWNgGAWDCTAyMv5n' +
    'IBB8+f+fgZGBgYGJkYmBgZGBgZGRkYGBgYGJkZGBgYGBgRkHAABkBAEBMrs1WAAAAABJRU5ErkJggg==';
  return nativeImage.createFromDataURL(`data:image/png;base64,${b64}`);
}

function createTray() {
  let icon;
  try {
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'icon.png')
      : path.join(__dirname, 'assets', 'icon.png');

    log(`Icon path: ${iconPath}`);
    if (fs.existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath);
      log(`Icon loaded, isEmpty: ${icon.isEmpty()}`);
    }
    if (!icon || icon.isEmpty()) {
      icon = getDefaultIcon();
      log('Using default fallback icon');
    }
  } catch (e) {
    log(`Icon error: ${e.message}`);
    icon = getDefaultIcon();
  }

  tray = new Tray(icon);
  tray.setToolTip(`PDF→JPEG Migration Tool (port ${PORT})`);

  const menu = Menu.buildFromTemplate([
    { label: '🌐 เปิดโปรแกรม', click: () => shell.openExternal(`http://localhost:${PORT}`) },
    { type: 'separator' },
    { label: `📁 Log: ${logFile}`, click: () => shell.openPath(logFile) },
    { type: 'separator' },
    { label: '❌ ปิดโปรแกรม', click: () => app.quit() }
  ]);

  tray.setContextMenu(menu);
  tray.on('click', () => shell.openExternal(`http://localhost:${PORT}`));
  log('Tray created');
}

app.whenReady().then(() => {
  log('app.whenReady fired');
  app.dock && app.dock.hide();

  try {
    createTray();
  } catch (e) {
    log(`Tray error: ${e.message}\n${e.stack}`);
    dialog.showErrorBox('Tray Error', e.message);
  }

  log('Starting Express server...');
  try {
    require('./server.js');
    log('server.js loaded OK');
  } catch (e) {
    log(`server.js error: ${e.message}\n${e.stack}`);
    dialog.showErrorBox('Server Error', `${e.message}\n\nLog: ${logFile}`);
    app.quit();
    return;
  }

  waitForServer(() => {
    log('Opening browser...');
    shell.openExternal(`http://localhost:${PORT}`);
    tray && tray.displayBalloon({
      title: 'Migration GotoWin to HOSxP',
      content: `เริ่มทำงานแล้ว — http://localhost:${PORT}`,
      iconType: 'info'
    });
  });
});

app.on('window-all-closed', () => {});

app.on('second-instance', () => {
  shell.openExternal(`http://localhost:${PORT}`);
});

process.on('uncaughtException', (e) => {
  log(`Uncaught: ${e.message}\n${e.stack}`);
  dialog.showErrorBox('Uncaught Error', `${e.message}\n\nLog: ${logFile}`);
});
