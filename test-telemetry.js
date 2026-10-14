const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3005;
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
  console.log(`Static test server started on http://localhost:${PORT}`);

  // Connect to Edge via CDP on port 9222
  const tabs = await (await fetch('http://localhost:9222/json')).json();
  const tab = tabs.find(t => t.type === 'page') || tabs[0];
  console.log('Connecting to tab:', tab.id, tab.type);

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

  await new Promise(r => (ws.onopen = r));
  console.log('WebSocket connection established');

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  await send('Page.navigate', { url: `http://localhost:${PORT}/index.html` });
  await new Promise(r => setTimeout(r, 1200));

  console.log('--- Simulating Participant Interaction ---');

  // 0. Simulate selecting 'Reclamação' and expanding builder
  await send('Runtime.evaluate', {
    expression: `
      const sel = document.getElementById('selectTipoAtendimento');
      sel.value = 'Reclamação';
      sel.dispatchEvent(new Event('change'));
      document.getElementById('btnToggleBuilder').click();
    `
  });
  await new Promise(r => setTimeout(r, 400));

  // 1. Simulate participant pause (Hesitation) then focus on "Qual é o problema" first
  await send('Runtime.evaluate', {
    expression: `
      // Expand field 2
      document.querySelector('.stepper-header[data-target="bodyProblema"]').click();
      const inpProb = document.getElementById('inputProblema');
      inpProb.focus();
      inpProb.dispatchEvent(new Event('focus'));
      inpProb.value = 'Aparelho desliga';
      inpProb.dispatchEvent(new Event('input'));
      
      // Simulate 3 backspaces
      inpProb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
      inpProb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
      inpProb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));

      // Complete problem text
      inpProb.value = 'O smartphone comprado parou de funcionar e desliga sozinho após 5 dias de uso.';
      inpProb.dispatchEvent(new Event('input'));
      inpProb.dispatchEvent(new Event('blur'));
    `
  });
  await new Promise(r => setTimeout(r, 400));

  // 2. Focus on "Relação de consumo", cut snippet and paste into "Tentativa de solução"
  await send('Runtime.evaluate', {
    expression: `
      document.querySelector('.stepper-header[data-target="bodyRelacao"]').click();
      const inpRel = document.getElementById('inputRelacao');
      inpRel.focus();
      inpRel.dispatchEvent(new Event('focus'));
      inpRel.value = 'Compra realizada dia 15/07/2026 nas Lojas Americanas por R$ 1.899,00.';
      inpRel.dispatchEvent(new Event('input'));
      
      // Simulate Cut from Relação
      if (window.Telemetry) {
        window.Telemetry.recordCut('relacao', 'Fui no SAC protocolo 123');
      }
      inpRel.dispatchEvent(new Event('blur'));

      // Simulate Paste into Tentativas
      document.querySelector('.stepper-header[data-target="bodyTentativas"]').click();
      const inpTent = document.getElementById('inputTentativas');
      inpTent.focus();
      inpTent.dispatchEvent(new Event('focus'));
      inpTent.value = 'Fui na loja física e no SAC (protocolo 20260718-99214).';
      if (window.Telemetry) {
        window.Telemetry.recordPaste('tentativas', 'Fui no SAC protocolo 123');
      }
      inpTent.dispatchEvent(new Event('input'));
      inpTent.dispatchEvent(new Event('blur'));

      // Fill Solução
      document.querySelector('.stepper-header[data-target="bodySolucao"]').click();
      const inpSol = document.getElementById('inputSolucao');
      inpSol.focus();
      inpSol.dispatchEvent(new Event('focus'));
      inpSol.value = 'Substituição imediata por novo aparelho ou devolução do valor integral.';
      inpSol.dispatchEvent(new Event('input'));
      inpSol.dispatchEvent(new Event('blur'));
    `
  });
  await new Promise(r => setTimeout(r, 500));

  // 3. Click "Analisar e gerar relato"
  console.log('Triggering AI generation...');
  await send('Runtime.evaluate', {
    expression: `
      document.getElementById('btnAnalyze').click();
    `
  });

  // Wait for simulation delay (1500ms + margin)
  await new Promise(r => setTimeout(r, 2200));

  // 4. Simulate user editing the AI generated text in the editor
  console.log('Simulating participant editing the AI text...');
  await send('Runtime.evaluate', {
    expression: `
      const ed = document.getElementById('relatoEditor');
      ed.focus();
      ed.dispatchEvent(new Event('focus'));
      ed.innerHTML = ed.innerHTML + '<p>Observação adicional do consumidor: O consumidor também levou a nota fiscal original nº 98412.</p>';
      ed.dispatchEvent(new Event('input'));
      ed.dispatchEvent(new Event('blur'));
    `
  });
  await new Promise(r => setTimeout(r, 500));

  // 5. Open Moderator Dashboard via Telemetry.openDashboard() or Ctrl+Shift+D
  console.log('Opening Moderator Dashboard...');
  await send('Runtime.evaluate', {
    expression: `
      window.Telemetry.openDashboard();
    `
  });
  await new Promise(r => setTimeout(r, 600));

  // Capture screenshot of the Moderator Dashboard (Top)
  const resScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(resScreenshot.result.data, 'base64');
  const screenshotPath = path.join(
    'C:/Users/GustavoSena/.gemini/antigravity/brain/43ff2aa4-7c27-4366-b7e2-f915172f508e/scratch',
    'moderator_dashboard_test.png'
  );
  fs.writeFileSync(screenshotPath, buffer);
  console.log('Moderator Dashboard screenshot saved to:', screenshotPath);

  // Scroll down the drawer body to view contents and cut/paste log
  await send('Runtime.evaluate', {
    expression: `
      const body = document.querySelector('.mod-drawer__body');
      if (body) body.scrollTop = body.scrollHeight;
    `
  });
  await new Promise(r => setTimeout(r, 400));

  const resScreenshot2 = await send('Page.captureScreenshot', { format: 'png' });
  const buffer2 = Buffer.from(resScreenshot2.result.data, 'base64');
  const screenshotPath2 = path.join(
    'C:/Users/GustavoSena/.gemini/antigravity/brain/43ff2aa4-7c27-4366-b7e2-f915172f508e/scratch',
    'moderator_dashboard_scrolled.png'
  );
  fs.writeFileSync(screenshotPath2, buffer2);
  console.log('Moderator Dashboard scrolled screenshot saved to:', screenshotPath2);

  // 6. Fetch Telemetry Summary
  const evalResult = await send('Runtime.evaluate', {
    expression: `
      JSON.stringify(window.Telemetry.getSummary(), null, 2);
    `,
    returnByValue: true
  });

  console.log('\n--- TELEMETRY SUMMARY REPORT ---');
  console.log(evalResult.result.result ? evalResult.result.result.value : evalResult.result);

  // Generate and log formatted report
  const formattedReport = await send('Runtime.evaluate', {
    expression: `window.Telemetry.generateFormattedReport();`,
    returnByValue: true
  });
  console.log('\n--- FORMATTED REPORT FOR MODERATOR ---');
  console.log(formattedReport.result.result ? formattedReport.result.result.value : formattedReport.result);

  // Cleanup
  ws.close();
  server.close();

  console.log('\nTest completed successfully!');
  process.exit(0);
});
