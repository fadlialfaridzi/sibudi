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

const POLL_INTERVAL = 30000; // 30 detik - cek perubahan hari libur
const FINE_INTERVAL = 1000 * 60 * 60 * 6; // 6 jam - recalc denda otomatis
const CHUNK_SIZE = 10000; // batch size per query
const PARALLEL_LIMIT = 10; // max concurrent queries
const MAX_LOG_LINES = 100; // simpan 100 baris terakhir log

const fineEmitter = new EventEmitter();
let isHolidayRunning = false;
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

    const [countRows] = await conn.query(
      "SELECT COUNT(*) AS total FROM loan WHERE is_lent=1 AND is_return=0"
    );
    const totalLoans = countRows[0].total || 0;

    logFine(`Hari ini: ${today.format("DD MMMM YYYY (dddd)")}`);
    logFine(`Jumlah hari libur: ${holidays.length}`);
    logFine(`Total loan aktif: ${totalLoans}`);

    if (totalLoans === 0) {
      logFine(`Tidak ada peminjaman aktif. Dihentikan.`);
      return;
    }

    let processedLoans = 0,
      overdueLoans = 0,
      insertedFines = 0,
      updatedFines = 0;

    for (let offset = 0; offset < totalLoans; offset += CHUNK_SIZE) {
      const [batch] = await conn.query(
        `SELECT loan_id, member_id, item_code, due_date, loan_rules_id, loan_date
         FROM loan
         WHERE is_lent=1 AND is_return=0
         ORDER BY loan_id ASC
         LIMIT ? OFFSET ?`,
        [CHUNK_SIZE, offset]
      );

      const tasks = batch.map(async (loan) => {
        processedLoans++;

        const dueDate = dayjs(loan.due_date).tz().startOf("day");
        if (!dueDate.isValid()) {
          skipReasons.invalidDueDate++;
          logFine(`⚠️ SKIP loan_id ${loan.loan_id}: due_date invalid`);
          return;
        }

        const overdueDays = today.diff(dueDate, "day");
        if (overdueDays <= 0) {
          skipReasons.notOverdue++;
          return;
        }

        // 🔸 Cek loan_rules_id valid
        if (!loan.loan_rules_id || loan.loan_rules_id === 0) {
          skipReasons.noFineRule++;
          logFine(
            `⚠️ SKIP → loan_id ${loan.loan_id} (${loan.item_code}): loan_rules_id kosong atau 0`
          );
          return;
        }

        const [[rule]] = await conn.query(
          "SELECT fine_each_day FROM mst_loan_rules WHERE loan_rules_id=?",
          [loan.loan_rules_id]
        );
        if (!rule || !rule.fine_each_day) {
          skipReasons.noFineRule++;
          logFine(
            `⚠️ SKIP loan_id ${loan.loan_id}: aturan denda tidak ditemukan`
          );
          return;
        }

        let validDays = 0;
        for (let i = 1; i <= overdueDays; i++) {
          const check = dueDate.add(i, "day");
          if (check.day() !== 0 && !holidays.includes(check.format("YYYY-MM-DD"))) {
            validDays++;
          }
        }

        if (validDays <= 0) {
          skipReasons.noValidDays++;
          return;
        }

        overdueLoans++;
        const totalFine = validDays * rule.fine_each_day;
        const fineDate = dueDate.add(1, "day").format("YYYY-MM-DD");
        const description = `Denda keterlambatan buku ${loan.item_code}`;

        const [existing] = await conn.query(
          "SELECT fines_id, debet FROM fines WHERE member_id=? AND description LIKE ? ORDER BY fines_id DESC LIMIT 1",
          [loan.member_id, `%${loan.item_code}%`]
        );

        if (existing.length > 0) {
          const oldDebet = existing[0].debet;
          if (oldDebet !== totalFine) {
            await conn.query(
              "UPDATE fines SET debet=?, fines_date=?, description=? WHERE fines_id=?",
              [totalFine, fineDate, description, existing[0].fines_id]
            );
            updatedFines++;
            logFine(
              `🔄 UPDATE ${loan.item_code} (member:${loan.member_id}) Rp${oldDebet}→Rp${totalFine}`
            );
          } else {
            skipReasons.noChange++;
          }
        } else {
          await conn.query(
            "INSERT INTO fines (member_id, fines_date, debet, credit, description) VALUES (?, ?, ?, 0, ?)",
            [loan.member_id, fineDate, totalFine, description]
          );
          insertedFines++;
          logFine(`➕ INSERT ${loan.item_code} (member:${loan.member_id}) Rp${totalFine}`);
        }
      });

      await Promise.all(tasks);
    }

    logFine(`PERHITUNGAN DENDA SELESAI`);
    logFine(`Diproses: ${processedLoans}, Terlambat: ${overdueLoans}, Insert: ${insertedFines}, Update: ${updatedFines}`);
    logFine(`Skip invalidDueDate:${skipReasons.invalidDueDate}, notOverdue:${skipReasons.notOverdue}, noFineRule:${skipReasons.noFineRule}, noValidDays:${skipReasons.noValidDays}, noChange:${skipReasons.noChange}`);
    logSeparator(logFine);
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

  setInterval(async () => {
    logFine(`⏰ Perhitungan denda terjadwal dimulai...`);
    await recalcFines();
  }, FINE_INTERVAL);

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
