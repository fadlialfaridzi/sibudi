// ======================================================
// services/liveMonitor.js
// 🔄 Background Service (Delta-Aware + Log Rotation + WIB Time)
// ======================================================

const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const { calculateDueDate } = require("../controllers/inside/peminjamanController");

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Jakarta");

// ======================================================
// ⚙️ Konfigurasi Dasar
// ======================================================
const LOG_DIR = path.join(__dirname, "../logs");
const LOG_FILE = path.join(LOG_DIR, "holiday-monitor.log");
const SNAPSHOT_FILE = path.join(LOG_DIR, "holiday-snapshot.json");
const POLL_INTERVAL = 30000; // 30 detik
const MAX_LOG_LINES = 50; // simpan 50 baris terakhir

let lastHolidaySnapshot = {}; // { id: "YYYY-MM-DD" }
let isRunning = false;

// ======================================================
// 🧩 Pastikan Folder Logs Ada
// ======================================================
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, "");
  }
} catch (err) {
  console.error("❌ Gagal membuat folder logs:", err);
}

// ======================================================
// 🧾 Logger Utility (Silent Console + Auto-trim + WIB)
// ======================================================
function getTimestamp() {
  return dayjs().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");
}

function trimOldLogs() {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    const lines = fs.readFileSync(LOG_FILE, "utf-8").split("\n");
    if (lines.length > MAX_LOG_LINES) {
      const trimmed = lines.slice(-MAX_LOG_LINES).join("\n");
      fs.writeFileSync(LOG_FILE, trimmed + "\n");
      fs.appendFileSync(
        LOG_FILE,
        `[${getTimestamp()}] 🧹 Log lama dipangkas — hanya ${MAX_LOG_LINES} baris terakhir disimpan.\n`
      );
    }
  } catch (err) {
    fs.appendFileSync(LOG_FILE, `[${getTimestamp()}] ⚠️ Gagal memangkas log: ${err.message}\n`);
  }
}

function log(message) {
  const formatted = `[${getTimestamp()}] ${message}\n`;
  try {
    fs.appendFileSync(LOG_FILE, formatted);
  } catch (err) {
    fs.appendFileSync(LOG_FILE, `[${getTimestamp()}] ❌ Error menulis log: ${err.message}\n`);
  }
}

// ======================================================
// 📦 Snapshot Utility
// ======================================================
function loadSnapshot() {
  try {
    if (fs.existsSync(SNAPSHOT_FILE)) {
      const data = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf-8"));
      if (data.records && typeof data.records === "object") {
        lastHolidaySnapshot = data.records;
        log(`📁 Snapshot holiday dipulihkan (${Object.keys(data.records).length} entri).`);
      }
    } else {
      log("📁 Snapshot tidak ditemukan — membuat snapshot baru.");
    }
  } catch (err) {
    log(`⚠️ Gagal memuat snapshot: ${err.message}`);
  }
}

function saveSnapshot(records) {
  try {
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify({ records }, null, 2));
    log(`💾 Snapshot disimpan (${Object.keys(records).length} holiday).`);
  } catch (err) {
    log(`⚠️ Gagal menyimpan snapshot: ${err.message}`);
  }
}

// ======================================================
// 🗓️ Ambil semua data holiday (id + date)
// ======================================================
async function fetchHolidays() {
  const [rows] = await db.query("SELECT holiday_id, holiday_date FROM holiday ORDER BY holiday_id ASC");
  return rows.map((r) => ({
    id: String(r.holiday_id),
    date: dayjs(r.holiday_date).format("YYYY-MM-DD"),
  }));
}

// ======================================================
// 🔄 Update due_date semua loan aktif jika ada perubahan holiday
// ======================================================
async function updateDueDatesForChange(changedDates, holidays) {
  log(`📅 Perubahan holiday terdeteksi (${changedDates.length} tanggal): ${changedDates.join(", ")}`);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [loans] = await connection.query(`
      SELECT loan_id, loan_date, due_date, loan_rules_id
      FROM loan
      WHERE is_lent = 1 AND is_return = 0
    `);

    if (loans.length === 0) {
      log("✅ Tidak ada loan aktif yang perlu diperbarui.");
      await connection.commit();
      connection.release();
      return;
    }

    let updatedCount = 0;

    for (const loan of loans) {
      const [ruleRows] = await connection.query(
        "SELECT loan_periode FROM mst_loan_rules WHERE loan_rules_id = ?",
        [loan.loan_rules_id]
      );
      if (ruleRows.length === 0) continue;

      const periode = ruleRows[0].loan_periode;
      const newDueDate = calculateDueDate(loan.loan_date, periode, holidays.map((h) => h.date));

      if (newDueDate !== loan.due_date) {
        await connection.query(
          "UPDATE loan SET due_date = ?, last_update = NOW() WHERE loan_id = ?",
          [newDueDate, loan.loan_id]
        );
        updatedCount++;
      }
    }

    await connection.commit();
    log(`✅ ${updatedCount} loan diperbarui karena perubahan holiday.`);
  } catch (err) {
    await connection.rollback();
    log(`❌ Error update loan: ${err.message}`);
  } finally {
    connection.release();
  }
}

// ======================================================
// 🔍 Deteksi Delta (Insert / Delete / Edit)
// ======================================================
async function detectHolidayDelta() {
  const holidays = await fetchHolidays();
  const currentMap = Object.fromEntries(holidays.map((h) => [h.id, h.date]));

  const oldIds = new Set(Object.keys(lastHolidaySnapshot));
  const newIds = new Set(Object.keys(currentMap));

  const insertedIds = [...newIds].filter((id) => !oldIds.has(id));
  const deletedIds = [...oldIds].filter((id) => !newIds.has(id));
  const updatedIds = [...newIds].filter(
    (id) => oldIds.has(id) && lastHolidaySnapshot[id] !== currentMap[id]
  );

  if (insertedIds.length === 0 && deletedIds.length === 0 && updatedIds.length === 0) {
    log("🕒 Tidak ada perubahan data holiday.");
    return;
  }

  if (insertedIds.length > 0) {
    const dates = insertedIds.map((id) => currentMap[id]);
    log(`🆕 ${insertedIds.length} holiday baru ditambahkan (ID: ${insertedIds.join(", ")}).`);
    await updateDueDatesForChange(dates, holidays);
  }

  if (updatedIds.length > 0) {
    const dates = updatedIds.map((id) => currentMap[id]);
    log(`✏️ ${updatedIds.length} holiday diubah (ID: ${updatedIds.join(", ")}).`);
    await updateDueDatesForChange(dates, holidays);
  }

  if (deletedIds.length > 0) {
    log(`⚠️ ${deletedIds.length} holiday dihapus (ID: ${deletedIds.join(", ")}).`);
    log("ℹ️ Tidak dilakukan rollback otomatis untuk penghapusan holiday.");
  }

  lastHolidaySnapshot = currentMap;
  saveSnapshot(currentMap);
}

// ======================================================
// 🚀 Jalankan background loop
// ======================================================
(async function startMonitor() {
  log("🚀 Live Monitor Holiday (Silent Mode + WIB) dimulai... Interval: 30 detik.");

  loadSnapshot();

  try {
    const holidays = await fetchHolidays();
    if (Object.keys(lastHolidaySnapshot).length === 0) {
      lastHolidaySnapshot = Object.fromEntries(holidays.map((h) => [h.id, h.date]));
      log(`📊 Inisialisasi awal: ${Object.keys(lastHolidaySnapshot).length} data holiday.`);
      saveSnapshot(lastHolidaySnapshot);
    }
  } catch (err) {
    log(`⚠️ Gagal inisialisasi awal: ${err.message}`);
  }

  setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await detectHolidayDelta();
      trimOldLogs();
    } catch (err) {
      log(`❌ Error monitor loop: ${err.message}`);
    } finally {
      isRunning = false;
    }
  }, POLL_INTERVAL);
})();
