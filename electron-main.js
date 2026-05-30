const { app, Tray, Menu, shell, nativeImage, dialog } = require('electron');
const path = require('path');
const http = require('http');

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

const PORT = 3004;

// กำหนด data directory (writable) สำหรับ config และ logs
const dataDir = app.getPath('userData');
process.env.APP_DATA_DIR = dataDir;

let tray = null;

function waitForServer(callback, retries = 30) {
  http.get(`http://localhost:${PORT}`, () => {
    callback();
  }).on('error', () => {
    if (retries > 0) setTimeout(() => waitForServer(callback, retries - 1), 500);
  });
}

function getIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icon.png');
  }
  return path.join(__dirname, 'assets', 'icon.png');
}

function createTray() {
  let icon;
  try {
    icon = nativeImage.createFromPath(getIconPath());
    if (icon.isEmpty()) icon = nativeImage.createEmpty();
  } catch (e) {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('PDF→JPEG Migration Tool');

  const menu = Menu.buildFromTemplate([
    {
      label: '🌐 เปิดโปรแกรม',
      click: () => shell.openExternal(`http://localhost:${PORT}`)
    },
    { type: 'separator' },
    {
      label: 'ℹ️ เกี่ยวกับ',
      click: () => dialog.showMessageBox({
        type: 'info',
        title: 'Migration GotoWin to HOSxP',
        message: 'PDF → JPEG Migration Tool',
        detail: `Port: ${PORT}\nVersion: 1.0.0\nData: ${dataDir}`
      })
    },
    { type: 'separator' },
    {
      label: '❌ ปิดโปรแกรม',
      click: () => app.quit()
    }
  ]);

  tray.setContextMenu(menu);
  tray.on('click', () => shell.openExternal(`http://localhost:${PORT}`));
}

app.whenReady().then(() => {
  app.dock && app.dock.hide();
  createTray();

  // Start Express server
  try {
    require('./server.js');
  } catch (e) {
    dialog.showErrorBox('เกิดข้อผิดพลาด', `ไม่สามารถเริ่ม server ได้:\n${e.message}\n\n${e.stack}`);
    app.quit();
    return;
  }

  // รอ server พร้อมแล้วเปิด browser
  waitForServer(() => {
    shell.openExternal(`http://localhost:${PORT}`);
  });
});

app.on('window-all-closed', () => {
  // ไม่ปิด app — ทำงานต่อใน system tray
});

app.on('second-instance', () => {
  shell.openExternal(`http://localhost:${PORT}`);
});
