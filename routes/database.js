const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'db_config.json');

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {
      return { source: {}, target: {}, tableConfig: {}, yearQueries: {} };
    }
  }
  return { source: {}, target: {}, tableConfig: {}, yearQueries: {} };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

// Test source connection (MySQL only)
router.post('/test-source', async (req, res) => {
  const { host, port, database, user, password } = req.body;
  let conn;
  try {
    conn = await mysql.createConnection({
      host: host || '127.0.0.1',
      port: parseInt(port) || 3306,
      database,
      user,
      password,
      connectTimeout: 8000
    });
    const [rows] = await conn.execute('SELECT VERSION() as version');
    res.json({ success: true, message: `เชื่อมต่อสำเร็จ (MySQL ${rows[0].version})` });
  } catch (err) {
    res.json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
});

// Test target connection (MySQL or PostgreSQL)
router.post('/test-target', async (req, res) => {
  const { dbType, host, port, database, user, password } = req.body;
  try {
    if (dbType === 'postgresql') {
      const client = new Client({
        host: host || '127.0.0.1',
        port: parseInt(port) || 5432,
        database,
        user,
        password,
        connectionTimeoutMillis: 8000
      });
      await client.connect();
      const result = await client.query('SELECT version()');
      const ver = result.rows[0].version.split(' ').slice(0, 2).join(' ');
      await client.end();
      res.json({ success: true, message: `เชื่อมต่อสำเร็จ (${ver})` });
    } else {
      const conn = await mysql.createConnection({
        host: host || '127.0.0.1',
        port: parseInt(port) || 3306,
        database,
        user,
        password,
        connectTimeout: 8000
      });
      const [rows] = await conn.execute('SELECT VERSION() as version');
      await conn.end();
      res.json({ success: true, message: `เชื่อมต่อสำเร็จ (MySQL ${rows[0].version})` });
    }
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Save source config
router.post('/save-source', (req, res) => {
  try {
    const config = loadConfig();
    config.source = req.body;
    saveConfig(config);
    res.json({ success: true, message: 'บันทึกข้อมูลเชื่อมต่อต้นทางสำเร็จ' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Save target config
router.post('/save-target', (req, res) => {
  try {
    const config = loadConfig();
    config.target = req.body;
    saveConfig(config);
    res.json({ success: true, message: 'บันทึกข้อมูลเชื่อมต่อปลายทางสำเร็จ' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Save table config
router.post('/save-table-config', (req, res) => {
  try {
    const config = loadConfig();
    config.tableConfig = req.body;
    saveConfig(config);
    res.json({ success: true, message: 'บันทึกการตั้งค่าตารางสำเร็จ' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Save custom year query
router.post('/save-year-query', (req, res) => {
  try {
    const { year, query } = req.body;
    const config = loadConfig();
    if (!config.yearQueries) config.yearQueries = {};
    if (query && query.trim()) {
      config.yearQueries[year] = query.trim();
    } else {
      delete config.yearQueries[year];
    }
    saveConfig(config);
    res.json({ success: true, message: `บันทึก SQL ปี ${year} สำเร็จ` });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Get saved configs
router.get('/config', (req, res) => {
  res.json(loadConfig());
});

// Get tables list from source DB
router.post('/source-tables', async (req, res) => {
  const config = loadConfig();
  if (!config.source || !config.source.host) {
    return res.json({ success: false, message: 'ยังไม่ได้บันทึกการเชื่อมต่อต้นทาง' });
  }
  let conn;
  try {
    conn = await mysql.createConnection({
      host: config.source.host,
      port: parseInt(config.source.port) || 3306,
      database: config.source.database,
      user: config.source.user,
      password: config.source.password,
      connectTimeout: 8000
    });
    const [rows] = await conn.execute('SHOW TABLES');
    const tables = rows.map(r => Object.values(r)[0]);
    res.json({ success: true, tables });
  } catch (err) {
    res.json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
});

module.exports = router;
