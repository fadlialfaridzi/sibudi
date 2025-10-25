// ======================================================
// services/liveMonitor.js
// Background Service: Memantau tabel holiday dan update loan aktif (dengan snapshot antar-restart)
// ======================================================

const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const dayjs = require('dayjs');
const { calculateDueDate } = require('../controllers/inside/peminjamanController');

// ======================================================
// ⚙️ Konfigurasi Dasar
// ======================================================
const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'holiday-monitor.log');
const SNAPSHOT_FILE = path.join(LOG_DIR, 'holiday-snapshot.json');
const POLL_INTERVAL = 30000; // 30 detik

let lastHolidayCount = 0;
let isRunning = false;
let debounceTimer = null;

// ======================================================
// 🧩 Pastikan Folder Logs Ada
// ======================================================
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    console.log(`📁 Folder logs dibuat otomatis di: ${LOG_DIR}`);
  }
} catch (err) {
  console.error('❌ Gagal membuat folder logs:', err);
}


// ======================================================
// 🧾 Logger Utility (Auto Rotate jika >10MB)
// ======================================================
function log(message) {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] ${message}\n`;
  console.log(formatted.trim());

  try {
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > 10 * 1024 * 1024) {
        fs.writeFileSync(LOG_FILE, ''); // reset jika >10MB
      }
    }
    fs.appendFileSync(LOG_FILE, formatted);
  } catch (err) {
    console.error('❌ Error menulis log:', err);
  }
}

// ======================================================
// 📦 Snapshot Utility
// ======================================================
function loadSnapshot() {
  try {
    if (fs.existsSync(SNAPSHOT_FILE)) {
      const data = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf-8'));
      if (typeof data.count === 'number') {
        lastHolidayCount = data.count;
        log(`📁 Snapshot holiday count dipulihkan: ${lastHolidayCount}`);
      }
    } else {
      log('📁 Snapshot tidak ditemukan, inisialisasi ulang dari DB.');
    }
  } catch (err) {
    log(`⚠️ Gagal memuat snapshot: ${err.message}`);
  }
}

function saveSnapshot(count) {
  try {
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify({ count }, null, 2));
    log(`💾 Snapshot disimpan: count = ${count}`);
  } catch (err) {
    log(`⚠️ Gagal menyimpan snapshot: ${err.message}`);
  }
}

// ======================================================
// 🗓️ Ambil semua tanggal holiday
// ======================================================
async function fetchHolidays() {
  const [rows] = await db.query('SELECT holiday_date FROM holiday');
  return rows.map(r => dayjs(r.holiday_date).format('YYYY-MM-DD'));
}

// ======================================================
// 🔄 Update due_date semua loan aktif jika ada libur baru
// ======================================================
async function updateDueDatesForNewHoliday(newHolidayDate, holidays) {
  log(`📅 Hari libur baru terdeteksi: ${newHolidayDate}`);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Ambil semua loan aktif
    const [loans] = await connection.query(`
      SELECT loan_id, loan_date, due_date, loan_rules_id
      FROM loan
      WHERE is_lent = 1 AND is_return = 0
    `);

    if (loans.length === 0) {
      log('✅ Tidak ada loan aktif yang perlu diperbarui.');
      await connection.commit();
      connection.release();
      return;
    }

    let updatedCount = 0;

    for (const loan of loans) {
      const [ruleRows] = await connection.query(
        'SELECT loan_periode FROM mst_loan_rules WHERE loan_rules_id = ?',
        [loan.loan_rules_id]
      );
      if (ruleRows.length === 0) continue;

      const periode = ruleRows[0].loan_periode;
      const newDueDate = calculateDueDate(loan.loan_date, periode, holidays);

      if (newDueDate !== loan.due_date) {
        await connection.query(
          'UPDATE loan SET due_date = ?, last_update = NOW() WHERE loan_id = ?',
          [newDueDate, loan.loan_id]
        );
        updatedCount++;
      }
    }

    await connection.commit();
    log(`✅ ${updatedCount} loan diperbarui karena hari libur baru.`);

  } catch (err) {
    await connection.rollback();
    log(`❌ Error update loan: ${err.message}`);
  } finally {
    connection.release();
  }
}

// ======================================================
// 🔁 Monitor perubahan di tabel holiday tiap 30 detik
// ======================================================
async function monitorHoliday() {
  if (isRunning) return;
  isRunning = true;

  try {
    const [rows] = await db.query('SELECT COUNT(*) AS count FROM holiday');
    const currentCount = rows[0].count;

    // Deteksi insert baru
    if (currentCount > lastHolidayCount) {
      log(`🔔 Deteksi penambahan hari libur: ${lastHolidayCount} → ${currentCount}`);

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const holidays = await fetchHolidays();
        const newHolidayDate = holidays[holidays.length - 1];
        await updateDueDatesForNewHoliday(newHolidayDate, holidays);
        saveSnapshot(currentCount); // simpan snapshot baru
      }, 2000);

      lastHolidayCount = currentCount;
    }

  } catch (err) {
    log(`❌ Error monitor holiday: ${err.message}`);
  } finally {
    isRunning = false;
  }
}

// ======================================================
// 🚀 Jalankan background loop
// ======================================================
(async function startMonitor() {
  log('🚀 Live Monitor dimulai (interval 30 detik)...');

  // 1️⃣ Pulihkan snapshot terakhir
  loadSnapshot();

  // 2️⃣ Jika snapshot tidak ada, ambil dari DB
  try {
    const [rows] = await db.query('SELECT COUNT(*) AS count FROM holiday');
    if (lastHolidayCount === 0) {
      lastHolidayCount = rows[0].count;
      log(`📊 Inisialisasi jumlah awal data holiday: ${lastHolidayCount}`);
      saveSnapshot(lastHolidayCount);
    }
  } catch (err) {
    log(`⚠️ Gagal inisialisasi monitor: ${err.message}`);
  }

  // 3️⃣ Jalankan interval loop
  setInterval(monitorHoliday, POLL_INTERVAL);
})();
