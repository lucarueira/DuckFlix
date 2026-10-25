const { app, BrowserWindow, dialog, ipcMain, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SITE = 'https://duckflix42.netlify.app';
const pending = new Map();
const approvedOrigins = new Set();
let mainWindow;
const desktopTheme = fs.readFileSync(path.join(__dirname, 'desktop-theme.css'), 'utf8');

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
    return { ok: true, data: Buffer.concat(chunks, size).toString('base64'), url: response.url, status: response.status };
  } catch (error) {
    throw new Error(controller.signal.aborted ? 'A fonte demorou demais para responder.' : error.message);
  } finally { clearTimeout(timer); if (pending.get(message.id) === controller) pending.delete(message.id); }
});

ipcMain.on('duckflix:cancel', (event, id) => { if (isTrusted(event) && typeof id === 'string') pending.get(id)?.abort(); });


// DuckSteam: downloads de jogos com progresso, velocidade e tempo restante.
const gameDownloads = new Map();
const TRUSTED_DOWNLOAD_HOSTS = new Set(['github.com']);
function sendDownload(payload) { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('duckflix:download-event', payload); }

ipcMain.handle('duckflix:download-start', async (event, message) => {
  if (!isTrusted(event) || !message || typeof message.id !== 'string' || message.id.length > 100) throw new Error('Solicitação inválida.');
  let url;
  try { url = new URL(message.url); } catch { throw new Error('Endereço de download inválido.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('O download precisa usar HTTPS sem credenciais.');
  if (gameDownloads.has(message.id)) throw new Error('Este download já está em andamento.');
  if (!TRUSTED_DOWNLOAD_HOSTS.has(url.hostname)) {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question', buttons: ['Baixar', 'Cancelar'], defaultId: 1, cancelId: 1,
      title: 'Autorizar download', message: `Baixar um arquivo de ${url.origin}?`,
      detail: 'Só baixe jogos de fontes em que você confia.'
    });
    if (response !== 0) throw new Error('Download cancelado.');
  }
  gameDownloads.set(message.id, { pendingUrl: url.href, item: null });
  mainWindow.webContents.downloadURL(url.href);
  return { ok: true };
});

function control(id, action) {
  const entry = gameDownloads.get(id);
  if (!entry?.item) return;
  if (action === 'pause' && !entry.item.isPaused()) entry.item.pause();
  if (action === 'resume' && entry.item.canResume()) entry.item.resume();
  if (action === 'cancel') entry.item.cancel();
}
ipcMain.on('duckflix:download-control', (event, id, action) => {
  if (isTrusted(event) && typeof id === 'string' && ['pause', 'resume', 'cancel'].includes(action)) control(id, action);
});
ipcMain.handle('duckflix:download-show', (event, id) => {
  if (!isTrusted(event)) return false;
  const savePath = gameDownloads.get(id)?.savePath;
  if (savePath) require('electron').shell.showItemInFolder(savePath);
  return Boolean(savePath);
});

function watchDownloads() {
  session.defaultSession.on('will-download', (event, item) => {
    const url = item.getURLChain()[0];
    const id = [...gameDownloads].find(([, entry]) => !entry.item && entry.pendingUrl === url)?.[0];
    if (!id) return;
    const entry = gameDownloads.get(id);
    const folder = path.join(app.getPath('downloads'), 'DuckSteam');
    fs.mkdirSync(folder, { recursive: true });
    entry.item = item;
    entry.savePath = path.join(folder, path.basename(item.getFilename()));
    item.setSavePath(entry.savePath);
    let lastBytes = 0, lastTime = Date.now(), speed = 0;
    const report = state => {
      const received = item.getReceivedBytes(), total = item.getTotalBytes();
      const now = Date.now();
      if (now - lastTime >= 700) { speed = ((received - lastBytes) / (now - lastTime)) * 1000; lastBytes = received; lastTime = now; }
      sendDownload({ id, state, received, total, speed, filename: path.basename(entry.savePath), eta: speed > 0 && total ? (total - received) / speed : null });
    };
    report('progressing');
    item.on('updated', (e, state) => report(state === 'interrupted' ? 'interrupted' : item.isPaused() ? 'paused' : 'progressing'));
    item.once('done', (e, state) => {
      sendDownload({ id, state: state === 'completed' ? 'completed' : state, received: item.getReceivedBytes(), total: item.getTotalBytes(), speed: 0, eta: 0, filename: path.basename(entry.savePath) });
      entry.item = null;
      if (state !== 'completed') gameDownloads.delete(id);
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 960, minHeight: 650, title: 'DuckFlix', backgroundColor: '#070b16',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow.webContents.on('dom-ready', () => {
    mainWindow?.webContents.insertCSS(desktopTheme).catch(() => {});
  });
  // Bloqueia pop-ups e redirecionamentos de anúncios sem tocar no vídeo incorporado.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try { if (new URL(url).origin !== SITE) event.preventDefault(); }
    catch { event.preventDefault(); }
  });
  mainWindow.loadURL(SITE);
}

app.whenReady().then(() => {
  watchDownloads();
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('before-quit', () => { for (const controller of pending.values()) controller.abort(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
