// ======================================================
// services/liveMonitor.js
// 🔄 Holiday + Fine Integrated Live Monitor (Indonesian Version)
// Per-Item Fine Calculation + Detailed Skip Reasons
// ======================================================

const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const dayjs = require("dayjs");
const EventEmitter = require("events");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const PQueue = require("p-queue").default;
const { calculateDueDate } = require("../controllers/inside/peminjamanController");

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Jakarta");

// ======================================================
// ⚙️ KONFIGURASI
// ======================================================
const LOG_DIR = path.join(__dirname, "../logs");
const HOLIDAY_LOG = path.join(LOG_DIR, "holiday-monitor.log");
const FINE_LOG = path.join(LOG_DIR, "fine-monitor.log");
const SNAPSHOT_FILE = path.join(LOG_DIR, "holiday-snapshot.json");
const POLL_INTERVAL = 30000; // 30 detik (deteksi perubahan holiday)
const FINE_POLL_INTERVAL = 60000; // 30 detik (cek denda)
const CHUNK_SIZE = 10000; // batch per loop
const PARALLEL_LIMIT = 10; // max concurrent query

const fineEmitter = new EventEmitter();
let isRunning = false;
let isFineRunning = false;
let lastHolidaySnapshot = {};

// Skip reasons counter
let skipReasons = {
  invalidDueDate: 0,
  notOverdue: 0,
  noFineRule: 0,
  noValidDays: 0,
  noChange: 0,
};

// ======================================================
// 🧩 PASTIKAN FOLDER LOG ADA
// ======================================================
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  console.log(`📁 Folder log dibuat: ${LOG_DIR}`);
}
if (!fs.existsSync(HOLIDAY_LOG)) fs.writeFileSync(HOLIDAY_LOG, "");
if (!fs.existsSync(FINE_LOG)) fs.writeFileSync(FINE_LOG, "");

// ======================================================
// 🧾 HELPER LOGGING (Auto-Trim)
// ======================================================
function ts() {
  return dayjs().tz().format("DD/MM/YYYY HH:mm:ss");
}

function appendAndTrim(filePath, message) {
  fs.appendFileSync(filePath, message + "\n");
  const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n");
  if (lines.length > MAX_LOG_LINES) {
    const trimmed = lines.slice(lines.length - MAX_LOG_LINES);
    fs.writeFileSync(filePath, trimmed.join("\n") + "\n");
  }
}

function logHoliday(msg, isError = false) {
  const prefix = isError ? "❌" : "📅";
  const line = `[${ts()}] ${prefix} ${msg}`;
  appendAndTrim(HOLIDAY_LOG, line);
  console.log(line); // holiday masih boleh tampil di terminal
}

function logFine(msg, isError = false) {
  const prefix = isError ? "❌" : "💰";
  const line = `[${ts()}] ${prefix} ${msg}`;
  appendAndTrim(FINE_LOG, line);
  // tidak console.log agar hanya masuk file log
}

function logSeparator(logFunc) {
  logFunc("=".repeat(80));
}

// ======================================================
// 📦 SNAPSHOT LOADER & SAVER
// ======================================================
function loadSnapshot() {
  try {
    if (fs.existsSync(SNAPSHOT_FILE)) {
      const data = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf-8"));
      lastHolidaySnapshot = data.records || {};

      const validSnapshot = {};
      let invalidCount = 0;

      for (const [id, date] of Object.entries(lastHolidaySnapshot)) {
        if (date && date !== "Invalid Date" && dayjs(date).isValid()) {
          validSnapshot[id] = date;
        } else {
          invalidCount++;
        }
      }

      lastHolidaySnapshot = validSnapshot;

      logHoliday(
        `Snapshot berhasil dimuat (${Object.keys(lastHolidaySnapshot).length} hari libur)`
      );
      if (invalidCount > 0) {
        logHoliday(`⚠️ ${invalidCount} tanggal tidak valid dihapus dari snapshot`);
      }
    } else {
      logHoliday(`Snapshot tidak ditemukan. Membuat snapshot baru...`);
    }
  } catch (e) {
    logHoliday(`Gagal memuat snapshot: ${e.message}`, true);
  }
}

function saveSnapshot(records) {
  try {
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify({ records }, null, 2));
    logHoliday(`Snapshot berhasil disimpan (${Object.keys(records).length} hari libur)`);
  } catch (e) {
    logHoliday(`Gagal menyimpan snapshot: ${e.message}`, true);
  }
}

// ======================================================
// 📆 AMBIL DATA HARI LIBUR DARI DATABASE
// ======================================================
async function fetchHolidays() {
  try {
    const [rows] = await db.query(
      "SELECT holiday_id, holiday_date FROM holiday WHERE holiday_date IS NOT NULL ORDER BY holiday_id ASC"
    );
    const holidays = rows
      .map((r) => dayjs(r.holiday_date).format("YYYY-MM-DD"))
      .filter((date) => date !== "Invalid Date" && dayjs(date).isValid());
    return holidays;
  } catch (e) {
    logHoliday(`Error mengambil data hari libur: ${e.message}`, true);
    return [];
  }
}

// ======================================================
// 💰 PERHITUNGAN ULANG DENDA (PER-ITEM)
// ======================================================
async function recalcFines() {
  if (isFineRunning) {
    logFine(`⏸️ Dilewati: perhitungan denda sedang berjalan`);
    return;
  }

  isFineRunning = true;
  skipReasons = {
    invalidDueDate: 0,
    notOverdue: 0,
    noFineRule: 0,
    noValidDays: 0,
    noChange: 0,
  };

  logSeparator(logFine);
  logFine(`PERHITUNGAN ULANG DENDA DIMULAI`);
  logFine(`Mode: Per-Item (berdasarkan item_code)`);

  const conn = await db.getConnection();

  try {
    const holidays = await fetchHolidays();
    const today = dayjs().tz().startOf("day");

    // PERBAIKAN: Filter hanya loan yang terlambat untuk efisiensi
    const [countRows] = await db.query(
      "SELECT COUNT(*) AS total FROM loan WHERE is_lent=1 AND is_return=0 AND due_date < CURDATE()"
    );
    const total = countRows[0].total;
    logFine(`📊 Found ${total} overdue loans (filtered from active loans)`);
    
    if (total === 0) {
      logFine("✅ No overdue loans to process.");
      return;
    }

    const queue = new PQueue({ concurrency: PARALLEL_LIMIT });
    let processedCount = 0;
    let updatedCount = 0;
    let insertedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    logFine(`🔄 Processing ${total} overdue loans in batches of ${CHUNK_SIZE}...`);

    for (let offset = 0; offset < total; offset += CHUNK_SIZE) {
      logFine(`📦 Batch ${Math.floor(offset / CHUNK_SIZE) + 1}: Processing loans ${offset + 1} to ${Math.min(offset + CHUNK_SIZE, total)}`);
      
      const [batch] = await db.query(
        `SELECT loan_id, member_id, item_code, due_date, loan_rules_id 
         FROM loan WHERE is_lent=1 AND is_return=0 AND due_date < CURDATE()
         LIMIT ? OFFSET ?`,
        [CHUNK_SIZE, offset]
      );

      batch.forEach((loan) =>
        queue.add(async () => {
          try {
            processedCount++;
            
            // Log setiap 10 loan untuk tracking progress
            if (processedCount % 10 === 0) {
              logFine(`📊 Progress: ${processedCount}/${total} loans processed...`);
            }
            
            const dueDate = dayjs(loan.due_date).tz();
            const diff = dayjs(today).diff(dueDate, "day");
            
            if (diff <= 0) {
              skippedCount++;
              return; // Skip tanpa log untuk efisiensi
            }

            const [[rule]] = await db.query("SELECT fine_each_day FROM mst_loan_rules WHERE loan_rules_id=?", [
              loan.loan_rules_id,
            ]);
            
            if (!rule) {
              skippedCount++;
              logFine(`⚠️ Skip ${loan.item_code}: loan rule not found (rule_id: ${loan.loan_rules_id})`);
              return;
            }

            // count only valid working days (max 365 days untuk safety)
            const maxDays = Math.min(diff, 365);
            let valid = 0;
            
            for (let i = 1; i <= maxDays; i++) {
              const d = dueDate.add(i, "day");
              if (d.day() !== 0 && !holidays.includes(d.format("YYYY-MM-DD"))) valid++;
            }
            
            if (valid <= 0) {
              skippedCount++;
              return; // Skip tanpa log
            }
            
            // Log jika ada denda yang akan dibuat/update
            if (valid > 0) {
              logFine(`💵 ${loan.item_code}: ${valid} working days overdue × Rp${rule.fine_each_day} = Rp${valid * rule.fine_each_day}`);
            }

            const fineVal = valid * rule.fine_each_day;
            
            // Cek apakah sudah ada denda untuk member ini di tanggal yang sama
            const finesDate = dueDate.add(1, "day").format("YYYY-MM-DD");
            const [existing] = await db.query(
              "SELECT fines_id, debet FROM fines WHERE member_id=? AND fines_date=? AND description LIKE ? ORDER BY fines_id DESC LIMIT 1",
              [loan.member_id, finesDate, `%${loan.item_code}%`]
            );

            if (existing.length > 0) {
              // Update jika nilai denda berubah
              if (existing[0].debet !== fineVal) {
                await db.query("UPDATE fines SET debet=? WHERE fines_id=?", [fineVal, existing[0].fines_id]);
                updatedCount++;
                logFine(`🔄 Updated fine for ${loan.item_code}, Rp${existing[0].debet} → Rp${fineVal} (fines_id: ${existing[0].fines_id})`);
              } else {
                skippedCount++;
              }
            } else {
              // Insert denda baru
              const desc = `Denda terlambat untuk eksemplar ${loan.item_code}`;
              await db.query(
                "INSERT INTO fines (member_id, fines_date, debet, description) VALUES (?, ?, ?, ?)",
                [loan.member_id, finesDate, fineVal, desc]
              );
              insertedCount++;
              logFine(`➕ Inserted new fine for ${loan.item_code}, Rp${fineVal} (date: ${finesDate})`);
            }
          } catch (err) {
            errorCount++;
            logFine(`❌ Error processing ${loan.item_code}: ${err.message}`);
          }
        })
      );
    }

    await queue.onIdle();
    logFine(`✅ Fine recalculation complete: ${processedCount} processed, ${updatedCount} updated, ${insertedCount} inserted, ${errorCount} errors`);
  } catch (err) {
    logFine(`❌ Error perhitungan denda: ${err.message}`, true);
    logFine(`Stack trace: ${err.stack}`, true);
  } finally {
    conn.release();
    isFineRunning = false;
  }
}

// ======================================================
// 🔍 DETEKSI PERUBAHAN HARI LIBUR
// ======================================================
async function detectHolidayDelta() {
  try {
    const [rows] = await db.query(
      "SELECT holiday_id, holiday_date FROM holiday WHERE holiday_date IS NOT NULL ORDER BY holiday_id ASC"
    );
    const current = {};
    for (const r of rows) {
      const date = dayjs(r.holiday_date).format("YYYY-MM-DD");
      if (date !== "Invalid Date" && dayjs(date).isValid()) {
        current[String(r.holiday_id)] = date;
      }
    }

    const oldIds = new Set(Object.keys(lastHolidaySnapshot));
    const newIds = new Set(Object.keys(current));
    const inserted = [...newIds].filter((id) => !oldIds.has(id));
    const deleted = [...oldIds].filter((id) => !newIds.has(id));
    const updated = [...newIds].filter(
      (id) => oldIds.has(id) && lastHolidaySnapshot[id] !== current[id]
    );

    if (inserted.length === 0 && deleted.length === 0 && updated.length === 0) return;

    if (inserted.length > 0)
      logHoliday(`➕ Hari libur baru: ${inserted.map((id) => current[id]).join(", ")}`);
    if (deleted.length > 0)
      logHoliday(`➖ Hari libur dihapus: ${deleted.map((id) => lastHolidaySnapshot[id]).join(", ")}`);
    if (updated.length > 0)
      logHoliday(`🔄 Hari libur diubah: ${updated.map((id) => `${lastHolidaySnapshot[id]}→${current[id]}`).join(", ")}`);

    lastHolidaySnapshot = current;
    saveSnapshot(current);
  } catch (e) {
    logHoliday(`Error mendeteksi perubahan hari libur: ${e.message}`, true);
  }
}

// ======================================================
// 🚀 START MONITOR
// ======================================================
(async function startMonitor() {
  console.log("\n" + "=".repeat(80));
  console.log("🚀 LAYANAN LIVE MONITOR DIMULAI");
  console.log("=".repeat(80));
  console.log(`📅 Interval cek hari libur : ${POLL_INTERVAL / 1000}s`);
  console.log(`💰 Interval recalc denda   : ${FINE_INTERVAL / 1000 / 60 / 60} jam`);
  console.log("=".repeat(80));

  loadSnapshot();

  try {
    logFine(`🕐 Menjalankan perhitungan denda awal saat startup...`);
    await recalcFines();
  } catch (e) {
    logFine(`❌ Perhitungan denda awal gagal: ${e.message}`, true);
  }

  fineEmitter.on("dueDateChanged", async () => {
    logFine(`📡 Event: due_date berubah, jalankan recalc ulang...`);
    await recalcFines();
  });

  // Polling for fine recalculation every 30s
  setInterval(async () => {
    if (isFineRunning) return;
    isFineRunning = true;
    try {
      await recalcFines();
    } catch (e) {
      logFine(`❌ Fine recalculation failed: ${e.message}`);
    } finally {
      isFineRunning = false;
    }
  }, FINE_POLL_INTERVAL);

  setInterval(async () => {
    if (isHolidayRunning) return;
    isHolidayRunning = true;
    try {
      await detectHolidayDelta();
    } catch (e) {
      logHoliday(`Error monitor hari libur: ${e.message}`, true);
    } finally {
      isHolidayRunning = false;
    }
  }, POLL_INTERVAL);

  console.log("✅ Semua monitor berhasil diinisialisasi\n");
})();
