// =============================================
// Global State
// =============================================
let selectedYear = null;
let currentConfigKey = null;
let currentJobId = null;
let progressEventSource = null;
let previewLoaded = false;
let selectedVns = new Set();

const YEARS_BE = [];
const CURRENT_BE = new Date().getFullYear() + 543;
for (let y = CURRENT_BE; y >= 2560; y--) YEARS_BE.push(y);

// =============================================
// Init
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
  renderYearButtons();
  await loadSavedConfig();
  // คืนสถานะซ่อน/แสดงฐานข้อมูล
  if (localStorage.getItem('dbConfigHidden') === '1') {
    document.getElementById('dbConfigBody').style.display = 'none';
    document.getElementById('dbConfigToggle').textContent = '▶ แสดง';
  }
});

// =============================================
// Year Buttons
// =============================================
function renderYearButtons() {
  const grid = document.getElementById('yearGrid');
  grid.innerHTML = '';
  YEARS_BE.forEach(be => {
    const ce = be - 543;
    const btn = document.createElement('button');
    btn.className = 'year-btn';
    btn.id = `year-btn-${be}`;
    btn.innerHTML = `พ.ศ. ${be}<span class="year-ce">ค.ศ. ${ce}</span>`;
    btn.onclick = () => selectYear(be);
    grid.appendChild(btn);
  });
}

function selectYear(be) {
  // Deactivate all
  document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`year-btn-${be}`).classList.add('active');

  selectedYear = be;
  currentConfigKey = String(be); // default = year, override ได้โดย selectMonth
  const ce = be - 543;

  // Set date range for the selected year
  document.getElementById('startDate').value = `${ce}-01-01`;
  document.getElementById('endDate').value   = `${ce}-12-31`;

  // Update panel title
  document.getElementById('transferPanelTitle').textContent = `โอนข้อมูลปี พ.ศ. ${be} (ค.ศ. ${ce})`;

  // Show panel
  const panel = document.getElementById('transferPanel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Reset state
  clearMsg('preview-msg');
  hideProgress();
  document.getElementById('previewTableWrap').style.display = 'none';
  document.getElementById('selectToolbar').style.display = 'none';
  document.getElementById('transferBtn').disabled = true;
  previewLoaded = false;
  selectedVns = new Set();

  // Load custom SQL for this year if saved
  loadYearConfig(be);
}

function selectMonth(configKey, be, startDate, endDate) {
  document.querySelectorAll('.month-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  selectYear(be);
  currentConfigKey = String(configKey); // override config key สำหรับเดือนเฉพาะ
  document.getElementById('startDate').value = startDate;
  document.getElementById('endDate').value = endDate;
}

function closeTransferPanel() {
  document.getElementById('transferPanel').style.display = 'none';
  document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.month-btn').forEach(b => b.classList.remove('active'));
  selectedYear = null;
  if (progressEventSource) {
    progressEventSource.close();
    progressEventSource = null;
  }
}

// =============================================
// Load Saved Config
// =============================================
async function loadSavedConfig() {
  try {
    const res = await fetch('/api/database/config');
    const data = await res.json();

    if (data.source) {
      setValue('src-host',     data.source.host     || '');
      setValue('src-port',     data.source.port     || '3306');
      setValue('src-database', data.source.database || '');
      setValue('src-user',     data.source.user     || '');
      setValue('src-password', data.source.password || '');
    }
    if (data.target) {
      const dbType = data.target.dbType || 'postgresql';
      document.querySelectorAll('input[name="tgt-dbtype"]').forEach(r => {
        r.checked = r.value === dbType;
      });
      setValue('tgt-host',     data.target.host     || '');
      setValue('tgt-port',     data.target.port     || (dbType === 'postgresql' ? '5432' : '3306'));
      setValue('tgt-database', data.target.database || '');
      setValue('tgt-user',     data.target.user     || '');
      setValue('tgt-password', data.target.password || '');
    }
    if (data.tableConfig) {
      const tc = data.tableConfig;
      setValue('src-table',    tc.sourceTable         || '');
      setValue('src-id-col',   tc.idColumn            || '');
      setValue('src-date-col', tc.dateColumn          || '');
      setValue('src-pdf-col',  tc.pdfColumn           || '');
      setValue('tgt-table',    tc.targetTable         || '');
      setValue('tgt-id-col',   tc.targetIdColumn      || '');
      setValue('tgt-date-col', tc.targetDateColumn    || '');
      setValue('tgt-image-col',tc.targetImageColumn   || '');
    }
  } catch (e) {
    console.error('Load config error:', e);
  }
}

function loadYearConfig(be) {
  // แสดง info ว่าปีนี้ใช้ query อะไร
  fetch(`/api/transfer/year-config/${be}`)
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showMsg('preview-msg', 'info',
          `ℹ️ <strong>${data.label}</strong> — ตารางปลายทาง: <strong>${data.targetTable}</strong>`
        );
      }
    }).catch(() => {});
}

// =============================================
// Source DB
// =============================================
async function testSource() {
  const data = getSourceData();
  showMsg('src-msg', 'loading', '<div class="spinner"></div> กำลังทดสอบการเชื่อมต่อ...');
  try {
    const res = await fetchPost('/api/database/test-source', data);
    showMsg('src-msg', res.success ? 'success' : 'error', (res.success ? '✅ ' : '❌ ') + res.message);
  } catch (e) {
    showMsg('src-msg', 'error', '❌ ' + e.message);
  }
}

async function saveSource() {
  const data = getSourceData();
  try {
    const res = await fetchPost('/api/database/save-source', data);
    showMsg('src-msg', res.success ? 'success' : 'error', (res.success ? '✅ ' : '❌ ') + res.message);
  } catch (e) {
    showMsg('src-msg', 'error', '❌ ' + e.message);
  }
}

function getSourceData() {
  return {
    host:     getValue('src-host'),
    port:     getValue('src-port'),
    database: getValue('src-database'),
    user:     getValue('src-user'),
    password: getValue('src-password')
  };
}

// =============================================
// Target DB
// =============================================
async function testTarget() {
  const data = getTargetData();
  showMsg('tgt-msg', 'loading', '<div class="spinner"></div> กำลังทดสอบการเชื่อมต่อ...');
  try {
    const res = await fetchPost('/api/database/test-target', data);
    showMsg('tgt-msg', res.success ? 'success' : 'error', (res.success ? '✅ ' : '❌ ') + res.message);
  } catch (e) {
    showMsg('tgt-msg', 'error', '❌ ' + e.message);
  }
}

async function saveTarget() {
  const data = getTargetData();
  try {
    const res = await fetchPost('/api/database/save-target', data);
    showMsg('tgt-msg', res.success ? 'success' : 'error', (res.success ? '✅ ' : '❌ ') + res.message);
  } catch (e) {
    showMsg('tgt-msg', 'error', '❌ ' + e.message);
  }
}

function getTargetData() {
  const dbType = document.querySelector('input[name="tgt-dbtype"]:checked').value;
  return {
    dbType,
    host:     getValue('tgt-host'),
    port:     getValue('tgt-port'),
    database: getValue('tgt-database'),
    user:     getValue('tgt-user'),
    password: getValue('tgt-password')
  };
}

function updateTargetPort(radio) {
  const port = radio.value === 'postgresql' ? '5432' : '3306';
  setValue('tgt-port', port);
}

// =============================================
// Table Config
// =============================================
function getTableConfig() {
  return {
    sourceTable:       getValue('src-table'),
    idColumn:          getValue('src-id-col'),
    dateColumn:        getValue('src-date-col'),
    pdfColumn:         getValue('src-pdf-col'),
    targetTable:       getValue('tgt-table'),
    targetIdColumn:    getValue('tgt-id-col'),
    targetDateColumn:  getValue('tgt-date-col'),
    targetImageColumn: getValue('tgt-image-col')
  };
}

async function saveTableConfig() {
  const data = getTableConfig();
  try {
    const res = await fetchPost('/api/database/save-table-config', data);
    showMsg('table-config-msg', res.success ? 'success' : 'error', (res.success ? '✅ ' : '❌ ') + res.message);
  } catch (e) {
    showMsg('table-config-msg', 'error', '❌ ' + e.message);
  }
}

function toggleDbConfig() {
  const body = document.getElementById('dbConfigBody');
  const btn  = document.getElementById('dbConfigToggle');
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'grid' : 'none';
  btn.textContent = isHidden ? '▼ ซ่อน' : '▶ แสดง';
  localStorage.setItem('dbConfigHidden', isHidden ? '0' : '1');
}

// =============================================
// Show Data (Preview)
// =============================================
async function showData() {
  if (!selectedYear) return;

  const startDate = getValue('startDate');
  const endDate   = getValue('endDate');

  if (!startDate || !endDate) {
    showMsg('preview-msg', 'error', '❌ กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด');
    return;
  }
  if (startDate > endDate) {
    showMsg('preview-msg', 'error', '❌ วันที่เริ่มต้นต้องน้อยกว่าหรือเท่ากับวันที่สิ้นสุด');
    return;
  }

  showMsg('preview-msg', 'loading', '<div class="spinner"></div> กำลังโหลดข้อมูล...');
  document.getElementById('previewTableWrap').style.display = 'none';

  try {
    const res = await fetchPost('/api/transfer/preview', {
      startDate, endDate, year: currentConfigKey || selectedYear
    });

    if (!res.success) {
      showMsg('preview-msg', 'error', '❌ ' + res.message);
      return;
    }

    const { data, total, skipped } = res;

    const skippedText = skipped > 0 ? ` | โอนแล้ว (ซ่อน): <strong style="color:#6b7280">${skipped}</strong>` : '';
    showMsg('preview-msg', 'info',
      `📊 พบทั้งหมด <strong>${total.toLocaleString()}</strong> รายการ
       | รอโอน: <strong style="color:#7c3aed">${data.length.toLocaleString()}</strong>${skippedText}`
    );

    // Reset header กลับเป็น source view
    document.getElementById('previewHead').innerHTML = `<tr>
      <th style="width:44px"><input type="checkbox" id="selectAllCheck2" checked onchange="toggleAllRows(this.checked)"></th>
      <th>#</th><th>HN</th><th>VN</th><th>วันที่-เวลาสแกน</th>
      <th>หน้า</th><th>รูปภาพ</th><th>ประเภท</th><th>HOS GUID</th><th>เจ้าหน้าที่</th><th>สถานะ</th>
    </tr>`;

    // สร้าง selectedVns ติ๊กทุก row ตั้งต้น (ใช้ composite key vn|hos_guid)
    selectedVns = new Set(data.map(r => `${r.vn}|${r.hos_guid}`));

    // Render table
    const tbody = document.getElementById('previewBody');
    tbody.innerHTML = '';

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:#94a3b8;padding:20px;">ไม่พบข้อมูลในช่วงวันที่ที่เลือก</td></tr>';
    } else {
      data.forEach((row, i) => {
        const hasImg = row.has_image == 1;
        const vn = row.vn || '';
        tbody.innerHTML += `
          <tr id="row-${vn}" class="row-selected">
            <td style="text-align:center">
              <input type="checkbox" class="row-check" data-key="${vn}|${row.hos_guid}" data-vn="${vn}" checked
                onchange="toggleRow('${vn}|${row.hos_guid}', this.checked)">
            </td>
            <td style="color:#94a3b8">${i + 1}</td>
            <td><strong>${row.hn || '-'}</strong></td>
            <td>${row.vn || '-'}</td>
            <td>${row.scan_date_time || '-'}</td>
            <td style="text-align:center">${row.pageno ?? '-'}</td>
            <td>${hasImg ? '<span class="badge-has">มีข้อมูล</span>' : '<span class="badge-no">ไม่มีข้อมูล</span>'}</td>
            <td>${row.image_type || '-'}</td>
            <td style="font-size:13px">${row.hos_guid || '-'}</td>
            <td>${row.officer || '-'}</td>
            <td>${statusBadge(row.status)}</td>
          </tr>`;
      });
    }

    document.getElementById('previewTitle').textContent =
      `ข้อมูลตัวอย่าง (พ.ศ. ${selectedYear})`;
    document.getElementById('previewTableWrap').style.display = 'block';
    document.getElementById('selectToolbar').style.display = 'flex';
    updateSelectedCount();

    // Enable transfer button only if data exists
    previewLoaded = total > 0;
    document.getElementById('transferBtn').disabled = !previewLoaded;

  } catch (e) {
    showMsg('preview-msg', 'error', '❌ ' + e.message);
  }
}

// =============================================
// Checkbox Selection
// =============================================
function toggleRow(key, checked) {
  if (checked) selectedVns.add(key);
  else         selectedVns.delete(key);
  updateSelectedCount();
  const total   = document.querySelectorAll('.row-check').length;
  const checked2 = document.querySelectorAll('.row-check:checked').length;
  ['selectAllCheck', 'selectAllCheck2'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked       = checked2 === total;
    el.indeterminate = checked2 > 0 && checked2 < total;
  });
}

function toggleAllRows(checked) {
  document.querySelectorAll('.row-check').forEach(cb => {
    cb.checked = checked;
    if (checked) selectedVns.add(cb.dataset.key);
    else         selectedVns.delete(cb.dataset.key);
  });
  ['selectAllCheck', 'selectAllCheck2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.checked = checked; el.indeterminate = false; }
  });
  updateSelectedCount();
}

function updateSelectedCount() {
  const count = document.querySelectorAll('.row-check:checked').length;
  const el = document.getElementById('selectedCount');
  if (el) el.textContent = `เลือก ${count.toLocaleString()} รายการ`;
  document.getElementById('transferBtn').disabled = count === 0;
}

// =============================================
// Show Transferred Records (Target DB)
// =============================================
async function showTransferred() {
  if (!selectedYear) return;

  const startDate = getValue('startDate');
  const endDate   = getValue('endDate');

  if (!startDate || !endDate) {
    showMsg('preview-msg', 'error', '❌ กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด');
    return;
  }

  showMsg('preview-msg', 'loading', '<div class="spinner"></div> กำลังโหลดข้อมูลจากฐานข้อมูลปลายทาง...');
  document.getElementById('previewTableWrap').style.display = 'none';
  document.getElementById('selectToolbar').style.display = 'none';

  try {
    const res = await fetchPost('/api/transfer/transferred', { startDate, endDate });

    if (!res.success) {
      showMsg('preview-msg', 'error', '❌ ' + res.message);
      return;
    }

    const { data, total } = res;

    showMsg('preview-msg', 'success',
      `✅ ข้อมูลปลายทาง (opdscan) พบ <strong>${total.toLocaleString()}</strong> รายการที่โอนแล้ว`
    );

    // Update table header for target view
    document.getElementById('previewHead').innerHTML = `<tr>
      <th>#</th>
      <th>Scan ID</th>
      <th>HN</th>
      <th>VN</th>
      <th>วันที่-เวลาสแกน</th>
      <th>หน้า</th>
      <th>ประเภท</th>
      <th>HOS GUID</th>
      <th>เจ้าหน้าที่</th>
      <th>ขนาดรูป (JPEG)</th>
    </tr>`;

    const tbody = document.getElementById('previewBody');
    tbody.innerHTML = '';

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#94a3b8;padding:20px;">ไม่พบข้อมูลในช่วงวันที่ที่เลือก</td></tr>';
    } else {
      data.forEach((row, i) => {
        tbody.innerHTML += `
          <tr>
            <td style="color:#94a3b8">${i + 1}</td>
            <td style="font-size:13px">${row.scan_id || '-'}</td>
            <td><strong>${row.hn || '-'}</strong></td>
            <td>${row.vn || '-'}</td>
            <td>${row.scan_date_time ? new Date(row.scan_date_time).toLocaleString('th-TH') : '-'}</td>
            <td style="text-align:center">${row.pageno ?? '-'}</td>
            <td>${row.image_type || '-'}</td>
            <td style="font-size:13px">${row.hos_guid || '-'}</td>
            <td>${row.officer || '-'}</td>
            <td>${formatBytes(row.img_size)}</td>
          </tr>`;
      });
    }

    document.getElementById('previewTitle').textContent = `รายการที่โอนแล้ว — opdscan (พ.ศ. ${selectedYear})`;
    document.getElementById('previewTableWrap').style.display = 'block';

  } catch (e) {
    showMsg('preview-msg', 'error', '❌ ' + e.message);
  }
}

// =============================================
// Show Records on Other Dates
// =============================================
async function showOtherDates() {
  if (!selectedYear) return;
  const startDate = getValue('startDate');
  const endDate   = getValue('endDate');
  if (!startDate || !endDate) {
    showMsg('preview-msg', 'error', '❌ กรุณาเลือกวันที่ก่อน');
    return;
  }

  showMsg('preview-msg', 'loading', '<div class="spinner"></div> กำลังค้นหาข้อมูลที่อยู่วันอื่น...');
  document.getElementById('previewTableWrap').style.display = 'none';
  document.getElementById('selectToolbar').style.display = 'none';

  try {
    const res = await fetchPost('/api/transfer/other-dates', {
      startDate, endDate, year: currentConfigKey || selectedYear
    });

    if (!res.success) {
      showMsg('preview-msg', 'error', '❌ ' + res.message);
      return;
    }

    const { data, total, sourceTotal } = res;
    const sameDate = sourceTotal - total;

    showMsg('preview-msg', total === 0 ? 'success' : 'info',
      `📅 ต้นทางมี <strong>${sourceTotal}</strong> vn &nbsp;|&nbsp;
       อยู่วันที่เลือก: <strong style="color:#16a34a">${sameDate}</strong> &nbsp;|&nbsp;
       อยู่วันอื่น: <strong style="color:#d97706">${total}</strong>
       ${total === 0 ? '<br>✅ ข้อมูลครบถ้วน ทุก record อยู่ในวันที่เลือก' : ''}`
    );

    document.getElementById('previewHead').innerHTML = `<tr>
      <th>#</th><th>Scan ID</th><th>HN</th><th>VN</th>
      <th style="color:#d97706">scan_date_time (วันที่จริง)</th>
      <th>หน้า</th><th>ประเภท</th><th>HOS GUID</th><th>เจ้าหน้าที่</th><th>ขนาด JPEG</th>
    </tr>`;

    const tbody = document.getElementById('previewBody');
    tbody.innerHTML = '';

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#16a34a;padding:20px;font-weight:700">✅ ไม่มีข้อมูลที่อยู่วันอื่น — ข้อมูลครบถ้วน</td></tr>';
    } else {
      data.forEach((row, i) => {
        const dt = row.scan_date_time ? new Date(row.scan_date_time).toLocaleString('th-TH') : '-';
        tbody.innerHTML += `
          <tr style="background:#fef9c3">
            <td style="color:#94a3b8">${i + 1}</td>
            <td style="font-size:13px">${row.scan_id || '-'}</td>
            <td><strong>${row.hn || '-'}</strong></td>
            <td>${row.vn || '-'}</td>
            <td style="color:#d97706;font-weight:700">${dt}</td>
            <td style="text-align:center">${row.pageno ?? '-'}</td>
            <td>${row.image_type || '-'}</td>
            <td style="font-size:13px">${row.hos_guid || '-'}</td>
            <td>${row.officer || '-'}</td>
            <td>${formatBytes(row.img_size)}</td>
          </tr>`;
      });
    }

    document.getElementById('previewTitle').textContent = `ข้อมูลที่อยู่วันอื่น — opdscan (พ.ศ. ${selectedYear})`;
    document.getElementById('previewTableWrap').style.display = 'block';
  } catch (e) {
    showMsg('preview-msg', 'error', '❌ ' + e.message);
  }
}

// =============================================
// Transfer Data
// =============================================
async function startTransfer() {
  if (!selectedYear || !previewLoaded) return;

  const startDate = getValue('startDate');
  const endDate   = getValue('endDate');

  const total = parseInt(document.getElementById('statTotal').textContent) || '?';
  if (!confirm(`ต้องการโอนข้อมูลปี ${selectedYear} (${startDate} ถึง ${endDate}) ใช่ไหม?\n\nกระบวนการนี้จะแปลง PDF เป็น JPEG และบันทึกลงฐานข้อมูลปลายทาง`)) {
    return;
  }

  // Stop any existing progress stream
  if (progressEventSource) {
    progressEventSource.close();
    progressEventSource = null;
  }

  showProgress();
  document.getElementById('transferBtn').disabled = true;
  document.getElementById('progressBar').style.width = '0%';
  document.getElementById('progressPercent').textContent = '0%';
  document.getElementById('statSuccess').textContent = '0';
  document.getElementById('statFailed').textContent  = '0';
  document.getElementById('statTotal').textContent   = '0';
  document.getElementById('progressLabel').textContent = 'กำลังเริ่มต้น...';
  document.getElementById('currentRecord').textContent = '';
  document.getElementById('errorList').innerHTML = '';

  try {
    const res = await fetchPost('/api/transfer/start', {
      startDate, endDate, year: currentConfigKey || selectedYear,
      selectedKeys: [...selectedVns]   // format: "vn|hos_guid"
    });

    if (!res.success) {
      showMsg('preview-msg', 'error', '❌ ' + res.message);
      hideProgress();
      document.getElementById('transferBtn').disabled = false;
      return;
    }

    currentJobId = res.jobId;
    listenProgress(currentJobId);

  } catch (e) {
    showMsg('preview-msg', 'error', '❌ ' + e.message);
    hideProgress();
    document.getElementById('transferBtn').disabled = false;
  }
}

function listenProgress(jobId) {
  progressEventSource = new EventSource(`/api/progress/${jobId}`);

  progressEventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      updateProgressUI(data);
    } catch {}
  };

  progressEventSource.onerror = () => {
    // Fallback to polling
    progressEventSource.close();
    progressEventSource = null;
    pollProgress(jobId);
  };
}

function pollProgress(jobId) {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/transfer/status/${jobId}`);
      const data = await res.json();
      if (data.success) {
        updateProgressUI(data);
        if (data.status === 'completed' || data.status === 'error') {
          clearInterval(interval);
        }
      }
    } catch {}
  }, 500);
}

function updateProgressUI(data) {
  if (!data || data.status === 'connecting') return;

  const pct = data.progress || 0;
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressPercent').textContent = pct + '%';
  document.getElementById('statSuccess').textContent = (data.success || 0).toLocaleString();
  document.getElementById('statFailed').textContent  = (data.failed  || 0).toLocaleString();
  document.getElementById('statTotal').textContent   = (data.total   || 0).toLocaleString();

  if (data.currentRecord) {
    document.getElementById('currentRecord').textContent = data.currentRecord;
  }

  // Show errors
  if (data.errors && data.errors.length > 0) {
    const errHtml = data.errors.map(e =>
      `<div class="error-item">ID ${e.id}: ${e.error}</div>`
    ).join('');
    document.getElementById('errorList').innerHTML = errHtml;
  }

  if (data.status === 'completed') {
    document.getElementById('progressLabel').textContent = '✅ โอนข้อมูลเสร็จสิ้น';
    document.getElementById('progressBar').style.background = 'linear-gradient(90deg, #16a34a, #22c55e)';
    document.getElementById('transferBtn').disabled = false;
    showMsg('preview-msg', 'success',
      `✅ โอนข้อมูลสำเร็จ: ${(data.success||0).toLocaleString()} รายการ` +
      (data.failed > 0 ? ` | ล้มเหลว: ${data.failed} รายการ` : '')
    );
    if (progressEventSource) { progressEventSource.close(); progressEventSource = null; }
  }

  if (data.status === 'error') {
    document.getElementById('progressLabel').textContent = '❌ เกิดข้อผิดพลาด';
    document.getElementById('progressBar').style.background = '#ef4444';
    document.getElementById('transferBtn').disabled = false;
    showMsg('preview-msg', 'error', '❌ ' + (data.message || 'เกิดข้อผิดพลาด'));
    if (progressEventSource) { progressEventSource.close(); progressEventSource = null; }
  }
}

// =============================================
// Helpers
// =============================================
function showProgress() {
  document.getElementById('progressSection').style.display = 'block';
  document.getElementById('progressBar').style.background = 'linear-gradient(90deg, #7c3aed, #a855f7)';
}

function hideProgress() {
  document.getElementById('progressSection').style.display = 'none';
}

function showMsg(id, type, html) {
  const el = document.getElementById(id);
  el.className = `msg-box ${type}`;
  el.innerHTML = html;
}

function clearMsg(id) {
  const el = document.getElementById(id);
  el.className = 'msg-box';
  el.innerHTML = '';
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

async function fetchPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

function statusBadge(status) {
  if (status === 'new')  return '<span class="badge-status new">🆕 ใหม่</span>';
  if (status === 'diff') return '<span class="badge-status diff">🔄 ประเภทต่างกัน</span>';
  return '-';
}

// =============================================
// Log Viewer
// =============================================
function toggleLogViewer() {
  const body = document.getElementById('logBody');
  const btn  = document.getElementById('logToggle');
  if (body.style.display === 'none') {
    body.style.display = 'block';
    btn.textContent = '▼ ซ่อน';
    loadLogs();
  } else {
    body.style.display = 'none';
    btn.textContent = '▶ แสดง';
  }
}

async function clearAllLogs() {
  if (!confirm('ต้องการลบ log ทั้งหมดใช่ไหม?')) return;
  try {
    const res = await fetch('/api/logs', { method: 'DELETE' }).then(r => r.json());
    document.getElementById('logDetail').style.display = 'none';
    await loadLogs();
  } catch (e) {
    alert('ลบไม่ได้: ' + e.message);
  }
}

async function loadLogs() {
  const container = document.getElementById('logList');
  container.innerHTML = '<p style="color:#94a3b8">กำลังโหลด...</p>';
  try {
    const files = await fetch('/api/logs').then(r => r.json());
    if (!files.length) {
      container.innerHTML = '<p style="color:#94a3b8">ยังไม่มีประวัติการโอนข้อมูล</p>';
      return;
    }
    container.innerHTML = files.map(f => {
      const date = new Date(f.mtime).toLocaleString('th-TH');
      const size = formatBytes(f.size);
      return `<div class="log-file-item">
        <div class="log-file-name">📄 ${f.name}</div>
        <div class="log-file-meta">${date} · ${size}</div>
        <button class="btn btn-outline btn-sm" onclick="viewLog('${f.name}')">🔍 ดูรายละเอียด</button>
        <a class="btn btn-outline btn-sm" href="/api/logs/download/${f.name}" download>⬇️ ดาวน์โหลด</a>
      </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = `<p style="color:#dc2626">❌ โหลด log ไม่ได้: ${e.message}</p>`;
  }
}

async function viewLog(filename) {
  try {
    const data = await fetch(`/api/logs/${filename}`).then(r => r.json());
    document.getElementById('logDetail').style.display = 'block';
    document.getElementById('logDetailTitle').textContent = filename;
    document.getElementById('logDownloadBtn').href = `/api/logs/download/${filename}`;
    document.getElementById('logDownloadBtn').download = filename;

    // Summary
    const errCount = (data.errors || []).length;
    document.getElementById('logSummary').innerHTML = `
      <strong>ปี:</strong> ${data.year || '-'} &nbsp;|&nbsp;
      <strong>วันที่:</strong> ${data.startDate} – ${data.endDate} &nbsp;|&nbsp;
      <strong>ทั้งหมด:</strong> ${(data.total||0).toLocaleString()} &nbsp;|&nbsp;
      <strong style="color:#16a34a">✅ สำเร็จ:</strong> ${(data.successCount||0).toLocaleString()} &nbsp;|&nbsp;
      <strong style="color:#dc2626">❌ ล้มเหลว:</strong> ${errCount.toLocaleString()} &nbsp;|&nbsp;
      <strong>เสร็จเมื่อ:</strong> ${data.completedAt ? new Date(data.completedAt).toLocaleString('th-TH') : '-'}
    `;

    // Errors only
    const errContainer = document.getElementById('logErrors');
    if (errCount === 0) {
      errContainer.innerHTML = `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center;margin-top:12px">
          <span style="font-size:18px">✅</span>
          <strong style="color:#16a34a;font-size:16px;margin-left:8px">ไม่มีข้อผิดพลาด — โอนข้อมูลสำเร็จทุกรายการ</strong>
        </div>`;
    } else {
      errContainer.innerHTML = `
        <div style="margin-top:14px">
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:10px;display:flex;align-items:center;gap:10px">
            <span style="font-size:20px">❌</span>
            <strong style="color:#dc2626;font-size:16px">รายการที่นำเข้าไม่สำเร็จ ${errCount.toLocaleString()} รายการ</strong>
          </div>
          <div class="log-error-wrap">
            <table class="log-error-table">
              <thead>
                <tr>
                  <th style="width:50px">#</th>
                  <th style="width:140px">HN</th>
                  <th>ข้อผิดพลาด</th>
                </tr>
              </thead>
              <tbody>
                ${data.errors.map((e, i) =>
                  `<tr>
                    <td style="color:#94a3b8">${i + 1}</td>
                    <td><strong>${e.id || '-'}</strong></td>
                    <td style="color:#dc2626;word-break:break-all">${e.error || '-'}</td>
                  </tr>`
                ).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
    }

    document.getElementById('logDetail').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    alert('โหลด log ไม่ได้: ' + e.message);
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}
