const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = process.env.APP_DATA_DIR
  ? path.join(process.env.APP_DATA_DIR, 'db_config.json')
  : path.join(__dirname, '..', 'db_config.json');
const LOG_DIR = process.env.APP_DATA_DIR
  ? path.join(process.env.APP_DATA_DIR, 'logs')
  : path.join(__dirname, '..', 'logs');

// =============================================
// Year-specific configurations (IPD)
// =============================================
const YEAR_CONFIGS = {
  2569: {
    label: 'ปี 2569 → ipt_chart_scan (กรองตามวันที่สแกน datescan)',
    // หมายเหตุ: ไม่มี ORDER BY / WHERE ชั้นนอก เพื่อให้ /start เติม WHERE ตาม selectedKeys ได้ก่อนค่อยปิดด้วย ORDER BY
    sourceQuery: `SELECT tbi.hn, tbi.an,
      99 AS ipt_chart_scan_type_id,
      tbd.imagescan AS scan_data,
      TIMESTAMP(tbi.datescan, tbi.timescan) AS scan_date_time,
      tbd.pages AS page,
      'PDF' AS image_type,
      tbd.doctype AS doc_type,
      tbi.\`user\` AS officer_name,
      'import' AS hos_guid
    FROM (
      SELECT an, hn, datescan, timescan, \`user\`
      FROM tb_ipd
      WHERE datescan BETWEEN ? AND ?
    ) tbi
    INNER JOIN tb_ipd_detail_2026 tbd ON tbd.an = CONVERT(tbi.an USING tis620)`,
    previewQuery: `SELECT tbi.hn, tbi.an,
      TIMESTAMP(tbi.datescan, tbi.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'PDF' AS image_type,
      tbd.doctype AS doc_type,
      tbi.\`user\` AS officer
    FROM (
      SELECT an, hn, datescan, timescan, \`user\`
      FROM tb_ipd
      WHERE datescan BETWEEN ? AND ?
    ) tbi
    INNER JOIN tb_ipd_detail_2026 tbd ON tbd.an = CONVERT(tbi.an USING tis620)
    ORDER BY tbi.an`,
    countQuery: `SELECT COUNT(*) AS total
    FROM (
      SELECT an FROM tb_ipd WHERE datescan BETWEEN ? AND ?
    ) tbi
    INNER JOIN tb_ipd_detail_2026 tbd ON tbd.an = CONVERT(tbi.an USING tis620)`,
    targetTable: 'ipt_chart_scan',
    pdfField: 'scan_data',
    idField: 'hn',
    fields: ['ipt_chart_scan_id', 'ipt_chart_scan_type_id', 'an', 'scan_data', 'scan_date_time', 'image_type', 'page', 'doc_type', 'officer_name', 'hos_guid']
  }
};

// =============================================
// Helpers
// =============================================
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (e) {}
  }
  return { source: {}, target: {}, yearQueries: {} };
}

async function createSourceConn(cfg) {
  return mysql.createConnection({
    host: cfg.host,
    port: parseInt(cfg.port) || 3306,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    supportBigNumbers: true
  });
}

async function createTargetConn(cfg) {
  if (cfg.dbType === 'postgresql') {
    const client = new Client({
      host: cfg.host,
      port: parseInt(cfg.port) || 5432,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password
    });
    await client.connect();
    client._dbType = 'pg';
    return client;
  }
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: parseInt(cfg.port) || 3306,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    supportBigNumbers: true
  });
  conn._dbType = 'mysql';
  return conn;
}

// ดึง MAX(ipt_chart_scan_id) จาก target แล้วเริ่ม counter ที่ MAX+1
async function resolveSerialMode(conn, tableName, isPg) {
  try {
    if (isPg) {
      const r = await conn.query(`SELECT COALESCE(MAX(ipt_chart_scan_id), 0) AS mx FROM "${tableName}"`);
      return parseInt(r.rows[0].mx) + 1;
    } else {
      const [r] = await conn.execute(`SELECT COALESCE(MAX(ipt_chart_scan_id), 0) AS mx FROM \`${tableName}\``);
      return parseInt(r[0].mx) + 1;
    }
  } catch (e) {
    console.warn('[Serial] MAX query failed, start from 1:', e.message);
    return 1;
  }
}

function writeLog(data) {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  const logFile = path.join(LOG_DIR, `transfer_ipd_${data.year}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(logFile, JSON.stringify(data, null, 2));
  return logFile;
}

// =============================================
// Preview
// =============================================
router.post('/preview', async (req, res) => {
  const { startDate, endDate, year } = req.body;
  const config = loadConfig();

  if (!config.source || !config.source.host) {
    return res.json({ success: false, message: 'ยังไม่ได้บันทึกข้อมูลเชื่อมต่อต้นทาง' });
  }

  const yearCfg = YEAR_CONFIGS[year] || YEAR_CONFIGS[parseInt(year)];
  if (!yearCfg) {
    return res.json({ success: false, message: `ยังไม่รองรับการโอนข้อมูลปี ${year}` });
  }

  let sourceConn, targetConn;
  try {
    sourceConn = await createSourceConn(config.source);

    // Count
    const [[countRow]] = await sourceConn.execute(yearCfg.countQuery, [startDate, endDate]);

    // Preview rows
    const [rows] = await sourceConn.execute(yearCfg.previewQuery, [startDate, endDate]);

    // เช็ค target ipt_chart_scan — ดึง an + scan_datetime ที่มีอยู่แล้ว (ไม่ผูกกับช่วงวันที่ outdate
    // เพราะ outdate เป็นวันที่จำหน่าย แต่ scan_datetime เป็นวันที่สแกน อาจคนละวันกัน)
    const targetSet = new Set();
    if (config.target && config.target.host && rows.length > 0) {
      try {
        targetConn = await createTargetConn(config.target);
        const isPg = config.target.dbType === 'postgresql';
        const ans = [...new Set(rows.map(r => r.an).filter(Boolean))];
        const buildSet = (tgtRows) => {
          tgtRows.forEach(r => {
            targetSet.add(`${r.an}|${new Date(r.scan_datetime).toISOString()}`);
          });
        };
        if (isPg) {
          const ph = ans.map((_, i) => `$${i + 1}`).join(',');
          const result = await targetConn.query(
            `SELECT an::text AS an, scan_datetime FROM ipt_chart_scan WHERE an::text IN (${ph})`,
            ans.map(String)
          );
          buildSet(result.rows);
        } else {
          const [tgtRows] = await targetConn.execute(
            `SELECT an, scan_datetime FROM \`ipt_chart_scan\` WHERE an IN (${ans.map(() => '?').join(',')})`,
            ans
          );
          buildSet(tgtRows);
        }
      } catch (e) {
        console.warn('[Preview-IPD] target check failed:', e.message);
      }
    }

    // กรอง: ซ่อนถ้า an + scan_date_time ตรงกับ target (ipt_chart_scan) แล้ว
    const filtered = rows.map(r => {
      const key = `${r.an}|${new Date(r.scan_date_time).toISOString()}`;
      const status = targetSet.has(key) ? 'done' : 'new';
      return { ...r, status };
    }).filter(r => r.status !== 'done');

    res.json({ success: true, data: filtered, total: countRow.total, skipped: rows.length - filtered.length });
  } catch (err) {
    res.json({ success: false, message: err.message });
  } finally {
    if (sourceConn) await sourceConn.end().catch(() => {});
    if (targetConn)  await targetConn.end().catch(() => {});
  }
});

// =============================================
// Start Transfer
// =============================================
router.post('/start', async (req, res) => {
  const { startDate, endDate, year, selectedKeys } = req.body;
  const config = loadConfig();

  if (!config.source || !config.source.host) {
    return res.json({ success: false, message: 'ยังไม่ได้บันทึกข้อมูลเชื่อมต่อต้นทาง' });
  }
  if (!config.target || !config.target.host) {
    return res.json({ success: false, message: 'ยังไม่ได้บันทึกข้อมูลเชื่อมต่อปลายทาง' });
  }

  const yearCfg = YEAR_CONFIGS[year] || YEAR_CONFIGS[parseInt(year)];
  if (!yearCfg) {
    return res.json({ success: false, message: `ยังไม่รองรับการโอนข้อมูลปี ${year}` });
  }

  const jobId = crypto.randomUUID();
  const progressStore = req.app.get('progressStore');
  progressStore.set(jobId, {
    jobId, status: 'running', progress: 0,
    total: 0, success: 0, failed: 0,
    currentRecord: 'กำลังเตรียมข้อมูล...', errors: [], startTime: Date.now()
  });

  res.json({ success: true, jobId });

  // Async transfer
  (async () => {
    let sourceConn, targetConn;
    const errors = [];

    try {
      sourceConn = await createSourceConn(config.source);
      targetConn = await createTargetConn(config.target);
      const isPg = config.target.dbType === 'postgresql';
      const targetTable = yearCfg.targetTable;

      // Fetch source records (กรองเฉพาะ an|doc_type ที่เลือก)
      let fetchQuery = yearCfg.sourceQuery;
      let fetchParams = [startDate, endDate];
      if (selectedKeys && selectedKeys.length > 0) {
        // parse "an|doc_type" pairs
        const pairs = selectedKeys.map(k => k.split('|'));
        fetchQuery += ` WHERE ${pairs.map(() => `(tbi.an = ? AND tbd.doctype = ?)`).join(' OR ')}`;
        fetchParams = [startDate, endDate, ...pairs.flat()];
      }
      fetchQuery += ' ORDER BY tbi.an';
      const [rows] = await sourceConn.execute(fetchQuery, fetchParams);
      const total = rows.length;
      progressStore.set(jobId, { ...progressStore.get(jobId), total });

      if (total === 0) {
        progressStore.set(jobId, { ...progressStore.get(jobId), status: 'completed', progress: 100, currentRecord: 'ไม่พบข้อมูลในช่วงวันที่ที่เลือก' });
        return;
      }

      // ดึง MAX(ipt_chart_scan_id) เริ่มต้น แล้ว +1 ทุก record
      let serialCounter = await resolveSerialMode(targetConn, targetTable, isPg);
      console.log(`[Transfer-IPD] เริ่ม ipt_chart_scan_id จาก: ${serialCounter}`);

      let successCount = 0, failedCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const hn = row.hn;

        progressStore.set(jobId, {
          ...progressStore.get(jobId),
          currentRecord: `กำลังประมวลผล HN: ${hn} (${i + 1}/${total})`
        });

        try {
          // ipt_chart_scan.scan_data เก็บ PDF ดิบ ไม่ต้องแปลงเป็น JPEG
          const pdfData = row[yearCfg.pdfField];
          if (!pdfData || pdfData.length < 5) throw new Error('ไม่มีข้อมูล PDF');

          const pdfBuffer = Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData);

          // ipt_chart_scan_id = counter ปัจจุบัน แล้ว +1
          const scanId = serialCounter++;
          if (i < 3) console.log(`[Transfer-IPD] i=${i} hn=${hn} ipt_chart_scan_id=${scanId}`);

          // ส่ง scan_date_time เป็น string ตรงๆ ป้องกัน timezone shift
          const scanDateTime = row.scan_date_time || new Date().toISOString().slice(0, 19).replace('T', ' ');

          // INSERT ลง ipt_chart_scan
          let rowInserted = false;
          if (isPg) {
            const result = await targetConn.query(
              `INSERT INTO "${targetTable}"
                (ipt_chart_scan_id, ipt_chart_scan_type_id, an, scan_data, scan_datetime, image_type, page, doc_type, officer_name, hos_guid)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (ipt_chart_scan_id) DO UPDATE SET
                 ipt_chart_scan_type_id = EXCLUDED.ipt_chart_scan_type_id,
                 an = EXCLUDED.an,
                 scan_data = EXCLUDED.scan_data,
                 scan_datetime = EXCLUDED.scan_datetime,
                 image_type = EXCLUDED.image_type,
                 page = EXCLUDED.page,
                 doc_type = EXCLUDED.doc_type,
                 officer_name = EXCLUDED.officer_name,
                 hos_guid = EXCLUDED.hos_guid`,
              [scanId, row.ipt_chart_scan_type_id, row.an, pdfBuffer, scanDateTime, row.image_type, row.page, row.doc_type, row.officer_name, row.hos_guid]
            );
            rowInserted = result.rowCount > 0;
          } else {
            const [result] = await targetConn.execute(
              `INSERT INTO \`${targetTable}\`
                (ipt_chart_scan_id, ipt_chart_scan_type_id, an, scan_data, scan_datetime, image_type, page, doc_type, officer_name, hos_guid)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 ipt_chart_scan_type_id = VALUES(ipt_chart_scan_type_id),
                 an = VALUES(an),
                 scan_data = VALUES(scan_data),
                 scan_datetime = VALUES(scan_datetime),
                 image_type = VALUES(image_type),
                 page = VALUES(page),
                 doc_type = VALUES(doc_type),
                 officer_name = VALUES(officer_name),
                 hos_guid = VALUES(hos_guid)`,
              [scanId, row.ipt_chart_scan_type_id, row.an, pdfBuffer, scanDateTime, row.image_type, row.page, row.doc_type, row.officer_name, row.hos_guid]
            );
            rowInserted = result.affectedRows > 0;
          }

          if (rowInserted) {
            successCount++;
          } else {
            failedCount++;
            errors.push({ id: hn, error: `INSERT ไม่สำเร็จ ipt_chart_scan_id=${scanId} (affectedRows=0)` });
          }
        } catch (rowErr) {
          failedCount++;
          errors.push({ id: hn, error: rowErr.message });
        }

        progressStore.set(jobId, {
          ...progressStore.get(jobId),
          progress: Math.round(((i + 1) / total) * 100),
          success: successCount,
          failed: failedCount,
          errors: errors
        });
      }

      const logFile = writeLog({ year, startDate, endDate, total, successCount, failedCount, errors, completedAt: new Date().toISOString() });

      progressStore.set(jobId, {
        ...progressStore.get(jobId),
        status: 'completed', progress: 100,
        success: successCount, failed: failedCount,
        currentRecord: `เสร็จสิ้น: สำเร็จ ${successCount} รายการ, ล้มเหลว ${failedCount} รายการ`,
        logFile
      });

    } catch (err) {
      progressStore.set(jobId, {
        ...progressStore.get(jobId),
        status: 'error',
        message: `เกิดข้อผิดพลาด: ${err.message}`
      });
    } finally {
      if (sourceConn) await sourceConn.end().catch(() => {});
      if (targetConn) await targetConn.end().catch(() => {});
    }
  })();
});

// หา AN ที่ยังไม่ถูกโอนไปยัง ipt_chart_scan (เทียบกับ an ทั้งหมดจาก source ตาม outdate ที่เลือก)
router.post('/other-dates', async (req, res) => {
  const { startDate, endDate, year } = req.body;
  const config = loadConfig();

  if (!config.source || !config.source.host) return res.json({ success: false, message: 'ยังไม่ได้บันทึกข้อมูลเชื่อมต่อต้นทาง' });
  if (!config.target || !config.target.host) return res.json({ success: false, message: 'ยังไม่ได้บันทึกข้อมูลเชื่อมต่อปลายทาง' });

  const configKey = String(year);
  const yearCfg = YEAR_CONFIGS[configKey] || YEAR_CONFIGS[parseInt(configKey)];
  if (!yearCfg) return res.json({ success: false, message: `ไม่พบ config สำหรับปี ${year}` });

  let sourceConn, targetConn;
  try {
    sourceConn = await createSourceConn(config.source);
    const [srcRows] = await sourceConn.execute(yearCfg.previewQuery, [startDate, endDate]);
    const ans = [...new Set(srcRows.map(r => r.an).filter(Boolean))];

    if (ans.length === 0) return res.json({ success: true, data: [], total: 0, sourceTotal: 0 });

    // หา an ที่มีอยู่ใน ipt_chart_scan แล้ว (เคยโอนแล้ว)
    targetConn = await createTargetConn(config.target);
    const isPg = config.target.dbType === 'postgresql';

    const existingAns = new Set();
    if (isPg) {
      const ph = ans.map((_, i) => `$${i + 1}`).join(',');
      const result = await targetConn.query(
        `SELECT DISTINCT an::text AS an FROM ipt_chart_scan WHERE an::text IN (${ph})`,
        ans.map(String)
      );
      result.rows.forEach(r => existingAns.add(r.an));
    } else {
      const [r] = await targetConn.execute(
        `SELECT DISTINCT an FROM \`ipt_chart_scan\` WHERE an IN (${ans.map(() => '?').join(',')})`,
        ans
      );
      r.forEach(row => existingAns.add(row.an));
    }

    // เหลือเฉพาะ record ต้นทางของ an ที่ "ยังไม่ถูกโอน" เลย
    const rows = srcRows.filter(r => !existingAns.has(r.an));

    res.json({ success: true, data: rows, total: rows.length, sourceTotal: ans.length });
  } catch (err) {
    res.json({ success: false, message: err.message });
  } finally {
    if (sourceConn) await sourceConn.end().catch(() => {});
    if (targetConn) await targetConn.end().catch(() => {});
  }
});

// Query transferred records from target DB
// หมายเหตุ: เทียบด้วย "an" ของ source ที่กรองตาม datescan (วันที่สแกน) ที่เลือก
router.post('/transferred', async (req, res) => {
  const { startDate, endDate, year } = req.body;
  const config = loadConfig();

  if (!config.source || !config.source.host) return res.json({ success: false, message: 'ยังไม่ได้บันทึกข้อมูลเชื่อมต่อต้นทาง' });
  if (!config.target || !config.target.host) return res.json({ success: false, message: 'ยังไม่ได้บันทึกข้อมูลเชื่อมต่อปลายทาง' });

  const yearCfg = YEAR_CONFIGS[year] || YEAR_CONFIGS[parseInt(year)];
  if (!yearCfg) return res.json({ success: false, message: `ไม่พบ config สำหรับปี ${year}` });

  let sourceConn, targetConn;
  try {
    // ดึง an ทั้งหมด (distinct) จาก source ตามวันที่สแกน (datescan) ที่เลือก
    sourceConn = await createSourceConn(config.source);
    const [srcRows] = await sourceConn.execute(yearCfg.countQuery.replace('SELECT COUNT(*) AS total', 'SELECT DISTINCT tbi.an'), [startDate, endDate]);
    const ans = srcRows.map(r => r.an).filter(Boolean);

    if (ans.length === 0) return res.json({ success: true, data: [], total: 0, sourceTotal: 0 });

    targetConn = await createTargetConn(config.target);
    const isPg = config.target.dbType === 'postgresql';

    let rows;
    if (isPg) {
      const ph = ans.map((_, i) => `$${i + 1}`).join(',');
      const result = await targetConn.query(
        `SELECT ipt_chart_scan_id, an, scan_datetime, image_type, doc_type, page, officer_name, hos_guid,
                COALESCE(LENGTH(scan_data), 0) AS img_size
         FROM ipt_chart_scan
         WHERE an::text IN (${ph})
         ORDER BY an, scan_datetime`,
        ans.map(String)
      );
      rows = result.rows;
    } else {
      const [r] = await targetConn.execute(
        `SELECT ipt_chart_scan_id, an, scan_datetime, image_type, doc_type, page, officer_name, hos_guid,
                COALESCE(LENGTH(scan_data), 0) AS img_size
         FROM \`ipt_chart_scan\`
         WHERE an IN (${ans.map(() => '?').join(',')})
         ORDER BY an, scan_datetime`,
        ans
      );
      rows = r;
    }

    res.json({ success: true, data: rows, total: rows.length, sourceTotal: ans.length });
  } catch (err) {
    res.json({ success: false, message: err.message });
  } finally {
    if (sourceConn) await sourceConn.end().catch(() => {});
    if (targetConn) await targetConn.end().catch(() => {});
  }
});

// Get job status (polling fallback)
router.get('/status/:jobId', (req, res) => {
  const progressStore = req.app.get('progressStore');
  const progress = progressStore.get(req.params.jobId);
  if (!progress) return res.json({ success: false, message: 'ไม่พบ Job ID' });
  res.json({ success: true, ...progress });
});

// Get year config info (for frontend display)
router.get('/year-config/:year', (req, res) => {
  const cfg = YEAR_CONFIGS[req.params.year] || YEAR_CONFIGS[parseInt(req.params.year)];
  if (!cfg) return res.json({ success: false });
  res.json({ success: true, label: cfg.label, sourceQuery: cfg.sourceQuery, targetTable: cfg.targetTable });
});

module.exports = router;
