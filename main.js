const { app, BrowserWindow, screen, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const COLLAPSED_WIDTH = 44; // 기본(보통) 너비, 시작 한 프레임용 폴백
const SIZE_COL = { large: 54, medium: 44, small: 36 };

let win = null;
let tray = null;
let currentSide = 'right';
let lastWidth = COLLAPSED_WIDTH;

function notesFilePath() {
  return path.join(app.getPath('userData'), 'notes.json');
}
function settingsFilePath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function defaultNotes() {
  return [{ id: 't1', title: '', color: '#FFE08A', body: '', url: '' }];
}
function defaultSettings() {
  return { mode: 'auto', pinned: false, autoLaunch: false, side: 'right', size: 'medium', opacity: 1 };
}

function loadNotes() {
  try {
    const parsed = JSON.parse(fs.readFileSync(notesFilePath(), 'utf-8'));
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return defaultNotes();
  } catch (e) {
    return defaultNotes();
  }
}
function saveNotes(notes) {
  try {
    fs.writeFileSync(notesFilePath(), JSON.stringify(notes, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('메모 저장 실패:', e);
    return false;
  }
}
function loadSettings() {
  try {
    return Object.assign(defaultSettings(), JSON.parse(fs.readFileSync(settingsFilePath(), 'utf-8')));
  } catch (e) {
    return defaultSettings();
  }
}
function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsFilePath(), JSON.stringify(settings, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('설정 저장 실패:', e);
    return false;
  }
}

// 창을 화면 왼쪽/오른쪽 가장자리에 붙임
function positionWindow(width) {
  if (!win) return;
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const area = display.workArea;
  const x = currentSide === 'left' ? area.x : area.x + area.width - width;
  win.setBounds({ x, y: area.y, width, height: area.height });
  lastWidth = width;
}

function createWindow() {
  win = new BrowserWindow({
    width: COLLAPSED_WIDTH,
    height: 600,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, 'screen-saver');

  const s = loadSettings();
  currentSide = s.side || 'right';
  positionWindow(SIZE_COL[s.size] || COLLAPSED_WIDTH);
  win.loadFile('index.html');

  // 처음엔 빈(투명) 영역으로 클릭이 통과하도록 설정.
  // 실제 탭/패널 위에 마우스가 오면 렌더러가 false로 바꿔줌.
  win.setIgnoreMouseEvents(true, { forward: true });

  win.on('blur', () => {
    if (win && !win.isDestroyed()) win.webContents.send('window-blur');
  });

  screen.on('display-metrics-changed', () => positionWindow(lastWidth));
}

// ---- 렌더러와의 통신 ----
ipcMain.handle('get-notes', () => loadNotes());
ipcMain.handle('save-notes', (_e, notes) => saveNotes(notes));
ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('save-settings', (_e, settings) => {
  saveSettings(settings);
  applyAutoLaunch(settings.autoLaunch);
  return true;
});

// 위치(좌/우)와 너비를 한 번에 적용
ipcMain.on('set-layout', (_e, payload) => {
  const { side, width } = payload || {};
  currentSide = side || 'right';
  positionWindow(width || COLLAPSED_WIDTH);
});

// 빈 영역 클릭 통과 토글 (true = 통과, false = 입력 받음)
ipcMain.on('set-ignore-mouse', (_e, ignore) => {
  if (!win || win.isDestroyed()) return;
  if (ignore) win.setIgnoreMouseEvents(true, { forward: true });
  else win.setIgnoreMouseEvents(false);
});

ipcMain.on('quit-app', () => app.quit());

function applyAutoLaunch(enabled) {
  try {
    app.setLoginItemSettings({ openAtLogin: !!enabled });
  } catch (e) {}
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, 'icon.png');
    if (!fs.existsSync(iconPath)) return;
    tray = new Tray(iconPath);
    const menu = Menu.buildFromTemplate([
      { label: '빼꼼 인덱스', enabled: false },
      { type: 'separator' },
      { label: '종료', click: () => app.quit() }
    ]);
    tray.setToolTip('빼꼼 인덱스');
    tray.setContextMenu(menu);
  } catch (e) {}
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  applyAutoLaunch(loadSettings().autoLaunch);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !tray) app.quit();
});
