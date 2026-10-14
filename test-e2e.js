const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const BASE_DIR = __dirname;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  let safeUrl = req.url.split('?')[0];
  if (safeUrl === '/') safeUrl = '/index.html';
  const filePath = path.join(BASE_DIR, safeUrl);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, async () => {
  console.log('Static server started on port', PORT);
  
  // Connect to Edge via CDP
  const tabs = await (await fetch('http://localhost:9222/json')).json();
  const tab = tabs[0];
  console.log('Connecting to tab:', tab.id);

  const ws = new WebSocket(tab.webSocketDebuggerUrl);

  let idCounter = 1;
  const pending = new Map();
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    }
  };

  const send = (method, params = {}) => {
    return new Promise((resolve) => {
      const id = idCounter++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await new Promise((r) => (ws.onopen = r));
  console.log('CDP WebSocket opened');

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1200,
    deviceScaleFactor: 1,
    mobile: false
  });

  await send('Page.navigate', { url: `http://localhost:${PORT}/index.html` });
  await new Promise((r) => setTimeout(r, 1000));

  const capture = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.result.data, 'base64');
    const outPath = path.join(
      'C:/Users/GustavoSena/.gemini/antigravity/brain/43ff2aa4-7c27-4366-b7e2-f915172f508e/scratch',
      name
    );
    fs.writeFileSync(outPath, buffer);
    console.log('Saved screenshot:', name);
  };

  // State 1: Fill the 4 directional inputs
  await send('Runtime.evaluate', {
    expression: `
      document.getElementById('inputRelacao').value = 'Compra de um smartphone no dia 15/07/2026 nas Lojas Americanas por R$ 1.899,00 com garantia de 12 meses.';
      document.getElementById('inputProblema').value = 'Aparelho começou a desligar sozinho após 5 dias de uso e não liga mais.';
      document.getElementById('inputTentativas').value = 'Fui até a loja e entrei em contato pelo SAC (Protocolo 20260718-99214). Pediram 30 dias mas não resolveram.';
      document.getElementById('inputSolucao').value = 'Troca imediata do aparelho por um novo ou restituição do valor pago.';
      document.getElementById('inputRelacao').dispatchEvent(new Event('input'));
    `
  });
  await new Promise((r) => setTimeout(r, 500));
  await capture('test_1_preenchido.png');

  // State 2: Click Analisar e gerar relato -> shows loading overlay!
  await send('Runtime.evaluate', {
    expression: `document.getElementById('btnAnalyze').click();`
  });
  await new Promise((r) => setTimeout(r, 200));
  await capture('test_2_loading.png');

  // State 3: Wait for AI generation completion (delay 1500ms + 500ms)
  await new Promise((r) => setTimeout(r, 2000));
  await capture('test_3_resultado_ia.png');

  // State 4: Click button again -> shows overwrite confirmation modal!
  await send('Runtime.evaluate', {
    expression: `document.getElementById('btnAnalyze').click();`
  });
  await new Promise((r) => setTimeout(r, 500));
  await capture('test_4_modal_confirmacao.png');

  console.log('All E2E test states captured successfully!');
  ws.close();
  server.close();
  process.exit(0);
});
