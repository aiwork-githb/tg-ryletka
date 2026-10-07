// VERITY TIME — Electron shell for the PC build.
// Loads the Vite build from dist/, exposes display settings through a small
// IPC bridge (see preload.cjs) and keeps a tiny settings file for switches
// that Chromium only reads at startup (VSync).
const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DEBUG = process.argv.includes('--debug') || !!process.env.VT_DEBUG;
const bootFile = () => path.join(app.getPath('userData'), 'boot.json');

function readBoot() {
  try {
    return JSON.parse(fs.readFileSync(bootFile(), 'utf8'));
  } catch {
    return { vsync: true, displayMode: 'fullscreen' };
  }
}
function writeBoot(patch) {
  const b = { ...readBoot(), ...patch };
  try {
    fs.mkdirSync(path.dirname(bootFile()), { recursive: true });
    fs.writeFileSync(bootFile(), JSON.stringify(b));
  } catch {
    /* read-only profile: ignore */
  }
  return b;
}

app.setName('VERITY TIME');
const boot = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'boot.json'), 'utf8'));
  } catch {
    return { vsync: true, displayMode: 'fullscreen' };
  }
})();
if (boot.vsync === false) {
  app.commandLine.appendSwitch('disable-gpu-vsync');
  app.commandLine.appendSwitch('disable-frame-rate-limit');
}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
if (process.env.VT_SMOKE) {
  // headless smoke runs have no GPU: render with SwiftShader
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
}

let win = null;

function create() {
  Menu.setApplicationMenu(null);
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: Math.min(1600, width),
    height: Math.min(900, height),
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#000000',
    show: false,
    title: 'VERITY TIME',
    autoHideMenuBar: true,
    fullscreen: boot.displayMode !== 'windowed',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: DEBUG,
      backgroundThrottling: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  // no navigation away from the game, no new windows
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  if (DEBUG) win.webContents.openDevTools({ mode: 'detach' });
  // smoke test for CI / packaging: VT_SMOKE=out.png captures the menu and quits
  if (process.env.VT_SMOKE) {
    win.webContents.on('console-message', (_e, level, message) => {
      if (level >= 2) console.log('[page]', message);
    });
    setTimeout(async () => {
      const img = await win.webContents.capturePage();
      fs.writeFileSync(process.env.VT_SMOKE, img.toPNG());
      const info = await win.webContents.executeJavaScript('JSON.stringify({ native: !!window.native, menu: !!document.querySelector(".menu-list"), debugHandle: typeof window.__VT })');
      console.log('[smoke]', info);
      app.quit();
    }, Number(process.env.VT_SMOKE_WAIT ?? 9000));
  }
}

ipcMain.on('vt:displayMode', (_e, mode) => {
  if (!win) return;
  writeBoot({ displayMode: mode });
  win.setFullScreen(mode !== 'windowed');
  if (mode === 'windowed') win.center();
});
ipcMain.on('vt:resolution', (_e, w, h) => {
  if (!win || win.isFullScreen()) return;
  const area = screen.getDisplayMatching(win.getBounds()).workAreaSize;
  win.setContentSize(Math.min(w, area.width), Math.min(h, area.height));
  win.center();
});
ipcMain.on('vt:vsync', (_e, on) => {
  writeBoot({ vsync: !!on });
});
ipcMain.on('vt:quit', () => app.quit());
ipcMain.handle('vt:displayInfo', () => {
  const d = screen.getDisplayMatching(win ? win.getBounds() : screen.getPrimaryDisplay().bounds);
  const sf = d.scaleFactor || 1;
  const W = Math.round(d.size.width * sf);
  const H = Math.round(d.size.height * sf);
  const common = [
    [1280, 720],
    [1366, 768],
    [1600, 900],
    [1920, 1080],
    [2560, 1440],
    [3840, 2160],
  ].filter(([w, h]) => w <= W && h <= H);
  if (!common.some(([w, h]) => w === W && h === H)) common.push([W, H]);
  return { resolutions: common, current: [W, H] };
});

app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
