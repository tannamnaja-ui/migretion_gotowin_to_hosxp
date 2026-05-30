// Shim: redirect require('canvas') → @napi-rs/canvas
// ต้องทำก่อน require pdfjs-dist เพราะ pdfjs-dist หา 'canvas' ตอน load
const Module = require('module');
const _origLoad = Module._load;
Module._load = function (request, ...args) {
  if (request === 'canvas') return require('@napi-rs/canvas');
  return _origLoad.apply(this, [request, ...args]);
};

let pdfjsLib = null;
let createCanvas = null;
let converterReady = false;
let converterError = null;

try {
  ({ createCanvas } = require('@napi-rs/canvas'));
} catch (e) {
  converterError = `@napi-rs/canvas: ${e.message}`;
}

try {
  pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc = false;
} catch (e) {
  converterError = `pdfjs-dist: ${e.message}`;
}

if (pdfjsLib && createCanvas) {
  converterReady = true;
  console.log('  [Converter] PDF → JPEG พร้อมใช้งาน');
} else {
  console.warn(`  [Converter] ไม่พร้อม: ${converterError}`);
}

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy() {}
}

async function convertPdfToJpeg(pdfBuffer, options = {}) {
  if (!converterReady) {
    throw new Error(`ไลบรารีแปลง PDF ยังไม่พร้อม (${converterError})`);
  }

  const { scale = 2.0, quality = 90, pageNum = 1 } = options;

  const header = pdfBuffer.slice(0, 5).toString('ascii');
  if (!header.startsWith('%PDF')) {
    throw new Error(`ข้อมูลไม่ใช่ PDF (header: ${header})`);
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    verbosity: 0,
    isEvalSupported: false
  });

  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (e) {
    throw new Error(`เปิด PDF ไม่ได้: ${e.message}`);
  }

  const page = await pdf.getPage(Math.min(pageNum, pdf.numPages));
  const viewport = page.getViewport({ scale });
  const canvasFactory = new NodeCanvasFactory();
  const { canvas, context } = canvasFactory.create(
    Math.floor(viewport.width),
    Math.floor(viewport.height)
  );

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: context, viewport, canvasFactory }).promise;
  await pdf.destroy();

  // encode JPEG
  try {
    return await canvas.encode('jpeg', quality);
  } catch (e1) {
    try {
      return canvas.toBuffer('image/jpeg');
    } catch (e2) {
      throw new Error(`แปลง canvas เป็น JPEG ไม่ได้: ${e2.message}`);
    }
  }
}

module.exports = { convertPdfToJpeg, converterReady, converterError };
