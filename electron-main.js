const { app, Tray, Menu, shell, nativeImage, dialog } = require('electron');
const path = require('path');
const http = require('http');

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

let tray = null;
const PORT = 3004;

// Set working directory to app root (สำหรับ packaged app)
if (app.isPackaged) {
  process.chdir(path.join(process.resourcesPath, 'app'));
}

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
        detail: `Port: ${PORT}\nVersion: 1.0.0`
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
  // ซ่อน dock icon (macOS)
  app.dock && app.dock.hide();

  // สร้าง tray
  createTray();

  // Start Express server
  try {
    require('./server.js');
  } catch (e) {
    dialog.showErrorBox('เกิดข้อผิดพลาด', `ไม่สามารถเริ่ม server ได้:\n${e.message}`);
    app.quit();
    return;
  }

  // รอ server พร้อมแล้วเปิด browser
  waitForServer(() => {
    shell.openExternal(`http://localhost:${PORT}`);
  });
});

app.on('window-all-closed', () => {
  // ไม่ปิด app เมื่อปิด window — ทำงานต่อใน system tray
});

app.on('second-instance', () => {
  // ถ้าเปิดซ้ำ ให้เปิด browser แทน
  shell.openExternal(`http://localhost:${PORT}`);
});
