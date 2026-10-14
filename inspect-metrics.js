const fs = require('fs');
const zlib = require('zlib');

// Let's decode and find:
// 1. Where does top-nav start and end?
// 2. Where does sub-nav start and end?
// 3. Where does main content start?
// 4. In sub-nav, where is the text "08.10.2026..." or "23.07.2026..."? (X position)
// 5. In main content, where is the left sidebar (Consumidor card) and main card (Atendimento)?

function decodePNG(filePath) {
  const buf = fs.readFileSync(filePath);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25];

  let idatList = [];
  let pos = 8;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IDAT') idatList.push(buf.slice(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idatList));
  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = 1 + width * bytesPerPixel;
  const pixels = [];
  for (let y = 0; y < height; y++) {
    const rowFilter = raw[y * stride];
    const row = Buffer.alloc(width * bytesPerPixel);
    const prevRow = y > 0 ? pixels[y - 1] : Buffer.alloc(width * bytesPerPixel);
    for (let x = 0; x < width * bytesPerPixel; x++) {
      const rawVal = raw[y * stride + 1 + x];
      const a = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const b = prevRow[x];
      const c = x >= bytesPerPixel ? prevRow[x - bytesPerPixel] : 0;
      let val = 0;
      if (rowFilter === 0) val = rawVal;
      else if (rowFilter === 1) val = (rawVal + a) & 0xff;
      else if (rowFilter === 2) val = (rawVal + b) & 0xff;
      else if (rowFilter === 3) val = (rawVal + Math.floor((a + b) / 2)) & 0xff;
      else if (rowFilter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        val = (rawVal + ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c))) & 0xff;
      }
      row[x] = val;
    }
    pixels.push(row);
  }
  return {
    width, height,
    getPixel: (x, y) => {
      const r = pixels[y][x * bytesPerPixel];
      const g = pixels[y][x * bytesPerPixel + 1];
      const b = pixels[y][x * bytesPerPixel + 2];
      return [r, g, b];
    }
  };
}

const dir = 'C:\\Users\\GustavoSena\\.gemini\\antigravity\\brain\\43ff2aa4-7c27-4366-b7e2-f915172f508e\\.user_uploaded';

function inspectPage(name, filename) {
  const img = decodePNG(dir + '\\' + filename);
  console.log(`\n=================== ${name} (${filename}) ===================`);
  
  // Find top-nav start Y (first dark blue row with r < 20, g < 60, b > 50)
  let navY = -1;
  for (let y = 0; y < img.height; y++) {
    const [r, g, b] = img.getPixel(100, y);
    if (r <= 25 && g <= 70 && b >= 60) {
      navY = y;
      break;
    }
  }
  console.log('Top-nav starts at Y:', navY);

  // Find where top-nav ends (transition from dark blue to white)
  let subNavY = -1;
  for (let y = navY; y < img.height; y++) {
    const [r, g, b] = img.getPixel(100, y);
    if (r > 200 && g > 200 && b > 200) {
      subNavY = y;
      break;
    }
  }
  console.log('Sub-nav starts at Y:', subNavY, '(top-nav height:', subNavY - navY, 'px)');

  // Find where sub-nav ends (transition from white to grayish background #f1f1f1 or #fafafa)
  let contentY = -1;
  for (let y = subNavY + 10; y < img.height; y++) {
    const [r, g, b] = img.getPixel(100, y);
    // Background is #f1f1f1 (241, 241, 241) or similar
    if (r < 248 || g < 248 || b < 248) {
      contentY = y;
      break;
    }
  }
  console.log('Content area starts at Y:', contentY, '(sub-nav height:', contentY - subNavY, 'px)');

  // Inside sub-nav (y = subNavY + 20), find text "08.10.2026..." or "23.07.2026..." (dark pixels)
  let subNavTextX = -1;
  for (let y = subNavY + 5; y < contentY - 5; y++) {
    for (let x = 0; x < img.width; x++) {
      const [r, g, b] = img.getPixel(x, y);
      if (r < 80 && g < 80 && b < 80) { // dark text
        if (subNavTextX === -1 || x < subNavTextX) subNavTextX = x;
      }
    }
  }
  console.log('Sub-nav process number starts at X:', subNavTextX);

  // In content area (e.g. y = contentY + 40), find cards:
  // Card is white (r>250, g>250, b>250)
  // Background is grayish (r < 245)
  const sampleY = contentY + 50;
  let card1Start = -1, card1End = -1, card2Start = -1, card2End = -1;
  let inCard = false;
  for (let x = 0; x < img.width; x++) {
    const [r, g, b] = img.getPixel(x, sampleY);
    const isWhite = (r >= 250 && g >= 250 && b >= 250);
    if (isWhite && !inCard) {
      inCard = true;
      if (card1Start === -1) card1Start = x;
      else if (card2Start === -1) card2Start = x;
    } else if (!isWhite && inCard) {
      inCard = false;
      if (card1End === -1) card1End = x;
      else if (card2End === -1) card2End = x;
    }
  }
  if (inCard) {
    if (card1End === -1) card1End = img.width;
    else if (card2End === -1) card2End = img.width;
  }
  console.log(`Cards at Y=${sampleY}:`);
  console.log(`  Sidebar (Consumidor): X=${card1Start}..${card1End} (width: ${card1End - card1Start}px)`);
  console.log(`  Main Card (Atendimento): X=${card2Start}..${card2End} (width: ${card2End - card2Start}px)`);
  console.log(`  Gap between cards: ${card2Start - card1End}px`);
  console.log(`  Alignment diff (Sub-nav X minus Sidebar X): ${subNavTextX - card1Start}px`);
}

inspectPage('SISTEMA REAL (Pequena)', 'media_1791469231791.png');
inspectPage('PROTÓTIPO (Pequena)', 'media_1791469223922.png');
inspectPage('SISTEMA REAL (Grande)', 'media_1791469271830.png');
inspectPage('PROTÓTIPO (Grande)', 'media_1791469280714.png');
