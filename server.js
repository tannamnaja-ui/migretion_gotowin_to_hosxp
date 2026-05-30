const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const LOG_DIR = path.join(__dirname, 'logs');

const app = express();
const PORT = 3004;

app.use(cors());
app.use(bodyParser.json({ limit: '200mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '200mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Global progress store for SSE
const progressStore = new Map();
app.set('progressStore', progressStore);

// Routes
app.use('/api/database', require('./routes/database'));
app.use('/api/transfer', require('./routes/transfer'));

// SSE endpoint for real-time transfer progress
app.get('/api/progress/:jobId', (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send initial ping
  res.write('data: {"status":"connecting"}\n\n');

  const interval = setInterval(() => {
    const progress = progressStore.get(jobId);
    if (progress) {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
      if (progress.status === 'completed' || progress.status === 'error') {
        clearInterval(interval);
        setTimeout(() => res.end(), 500);
      }
    }
  }, 300);

  req.on('close', () => {
    clearInterval(interval);
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// รายการไฟล์ log
app.get('/api/logs', (req, res) => {
  if (!fs.existsSync(LOG_DIR)) return res.json([]);
  const files = fs.readdirSync(LOG_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const stat = fs.statSync(path.join(LOG_DIR, f));
      return { name: f, size: stat.size, mtime: stat.mtime };
    })
    .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
  res.json(files);
});

// ดูเนื้อหา log file
app.get('/api/logs/:filename', (req, res) => {
  const file = path.join(LOG_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'ไม่พบไฟล์' });
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  res.json(data);
});

// ลบ log file เดียว
app.delete('/api/logs/:filename', (req, res) => {
  const file = path.join(LOG_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'ไม่พบไฟล์' });
  fs.unlinkSync(file);
  res.json({ success: true });
});

// ลบ log ทั้งหมด
app.delete('/api/logs', (req, res) => {
  if (!fs.existsSync(LOG_DIR)) return res.json({ success: true, deleted: 0 });
  const files = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.json'));
  files.forEach(f => fs.unlinkSync(path.join(LOG_DIR, f)));
  res.json({ success: true, deleted: files.length });
});

// ดาวน์โหลด log file
app.get('/api/logs/download/:filename', (req, res) => {
  const file = path.join(LOG_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(file)) return res.status(404).send('ไม่พบไฟล์');
  res.download(file);
});

app.listen(PORT, () => {
  console.log('');
  console.log('  ╔════════════════════════════════════════╗');
  console.log('  ║   PDF → JPEG Migration Tool            ║');
  console.log('  ║   ระบบโอนข้อมูล PDF เป็น JPEG         ║');
  console.log(`  ║   http://localhost:${PORT}                ║`);
  console.log('  ╚════════════════════════════════════════╝');
  console.log('');
});
