const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { updateElectronApp } = require('update-electron-app');
const { randomUUID } = require('node:crypto');

const SITE = 'https://duckflix42.netlify.app';
const pending = new Map();
const approvedOrigins = new Set();
let mainWindow;
let introWindow;
const popups = new Set();

function isTrusted(event) {
  try { return new URL(event.senderFrame.url).origin === SITE; } catch { return false; }
}

async function requestAccess(origin) {
  if (approvedOrigins.has(origin)) return true;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question', buttons: ['Permitir neste uso', 'Cancelar'], defaultId: 1, cancelId: 1,
    title: 'Autorizar fonte de vídeo', message: `DuckFlix quer carregar uma transmissão de ${origin}.`,
    detail: 'A autorização vale enquanto o aplicativo estiver aberto. Só permita fontes em que você confia.'
  });
  if (response !== 0) return false;
  approvedOrigins.add(origin);
  return true;
}

ipcMain.handle('duckflix:request', async (event, message) => {
  if (!isTrusted(event) || !message || !['ping', 'fetch'].includes(message.type)) throw new Error('Solicitação inválida.');
  if (message.type === 'ping') return { ok: true, version: app.getVersion(), desktop: true };
  if (typeof message.id !== 'string' || message.id.length > 100) throw new Error('Identificador inválido.');
  if (pending.size >= 12) throw new Error('O aplicativo já está carregando 12 recursos. Aguarde um instante.');
  if (pending.has(message.id)) throw new Error('Solicitação repetida.');
  let url;
  try { url = new URL(message.url); } catch { throw new Error('Endereço de fonte inválido.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('A fonte precisa usar HTTP ou HTTPS sem credenciais.');
  if (message.range && !/^bytes=\d+-\d*$/.test(message.range)) throw new Error('Intervalo de vídeo inválido.');
  const controller = new AbortController();
  pending.set(message.id, controller);
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    if (!await requestAccess(url.origin)) throw new Error(`Acesso cancelado para ${url.origin}.`);
    if (controller.signal.aborted) throw new Error('Requisição cancelada.');
    const response = await fetch(url, { signal: controller.signal, redirect: 'error', credentials: 'omit', headers: message.range ? { Range: message.range } : {} });
    if (!response.ok) throw new Error(`A fonte respondeu HTTP ${response.status}.`);
    if (message.range && response.status !== 206) throw new Error('A fonte não aceitou a leitura parcial do vídeo.');
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 24 * 1024 * 1024) { await reader.cancel(); throw new Error('A resposta excede 24 MB. Segmentos HLS funcionam melhor com o DuckFlix Desktop.'); }
      chunks.push(Buffer.from(value));
    }
    const bytes = Buffer.concat(chunks, size);
    return { ok: true, data: bytes.toString('base64'), url: response.url, status: response.status };
  } catch (error) {
    throw new Error(controller.signal.aborted ? 'A fonte demorou demais para responder.' : error.message);
  } finally { clearTimeout(timer); if (pending.get(message.id) === controller) pending.delete(message.id); }
});

ipcMain.on('duckflix:cancel', (event, id) => { if (isTrusted(event) && typeof id === 'string') pending.get(id)?.abort(); });

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320, height: 850, minWidth: 900, minHeight: 650, title: 'DuckFlix', backgroundColor: '#090909',
    icon: require('node:path').join(app.getAppPath(), 'img/duckflix42.ico'),
    webPreferences: { preload: require('node:path').join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { openPopup(url); return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try { if (new URL(url).origin !== SITE) { event.preventDefault(); openPopup(url); } }
    catch { event.preventDefault(); }
  });
  mainWindow.loadURL(`${SITE}/?desktopIntro=1`);
}

function openPopup(value) {
  if (popups.size >= 3) return;
  let url;
  try { url = new URL(value); } catch { return; }
  if (!['http:', 'https:'].includes(url.protocol)) return;
  const popup = new BrowserWindow({
    parent: mainWindow, width: 1120, height: 760, minWidth: 760, minHeight: 540,
    title: 'DuckFlix · Conteúdo', backgroundColor: '#090909',
    webPreferences: {
      ...(url.origin === SITE ? { preload: require('node:path').join(__dirname, 'preload.cjs') } : {}),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  popups.add(popup);
  popup.once('closed', () => popups.delete(popup));
  popup.webContents.setWindowOpenHandler(({ url: next }) => { openPopup(next); return { action: 'deny' }; });
  popup.webContents.on('will-navigate', (event, next) => {
    try { if (!['http:', 'https:'].includes(new URL(next).protocol)) event.preventDefault(); }
    catch { event.preventDefault(); }
  });
  popup.loadURL(url.href);
}

ipcMain.on('duckflix:intro-complete', event => {
  if (!introWindow || event.sender !== introWindow.webContents) return;
  introWindow.close();
  introWindow = null;
  createWindow();
});

function showIntro() {
  const path = require('node:path');
  introWindow = new BrowserWindow({
    width: 920, height: 620, minWidth: 640, minHeight: 420, frame: false, center: true,
    show: false, backgroundColor: '#09090e', icon: path.join(app.getAppPath(), 'img/duckflix42.ico'),
    webPreferences: { preload: path.join(__dirname, 'splash-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  introWindow.once('ready-to-show', () => introWindow?.show());
  introWindow.loadFile(path.join(__dirname, 'splash.html'));
  setTimeout(() => { if (introWindow && !introWindow.isDestroyed()) introWindow.webContents.send('duckflix:intro-fallback'); }, 12000);
}

app.whenReady().then(() => {
  if (app.isPackaged) updateElectronApp({ repo: 'lucarueira/DuckFlix' });
  showIntro();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) showIntro(); });
});
app.on('before-quit', () => { for (const controller of pending.values()) controller.abort(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
