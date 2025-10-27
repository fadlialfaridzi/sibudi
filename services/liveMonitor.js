// ======================================================
// services/liveMonitor.js
// 🔄 Holiday + Fine Integrated Live Monitor (Event + Schedule Edition)
// ======================================================

const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const dayjs = require("dayjs");
const EventEmitter = require("events");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const PQueue = require("p-queue").default; // untuk limit paralel
const { calculateDueDate } = require("../controllers/inside/peminjamanController");

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Jakarta");

// ======================================================
// ⚙️ Config
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

// ======================================================
// 🧩 Ensure log folders
// ======================================================
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(HOLIDAY_LOG)) fs.writeFileSync(HOLIDAY_LOG, "");
if (!fs.existsSync(FINE_LOG)) fs.writeFileSync(FINE_LOG, "");

// ======================================================
// 🧾 Logging helpers
// ======================================================
function ts() {
  return dayjs().tz().format("YYYY-MM-DD HH:mm:ss");
}

function logHoliday(msg) {
  fs.appendFileSync(HOLIDAY_LOG, `[${ts()}] ${msg}\n`);
}

function logFine(msg) {
  fs.appendFileSync(FINE_LOG, `[${ts()}] ${msg}\n`);
}

// ======================================================
// 📦 Snapshot loader
// ======================================================
function loadSnapshot() {
  try {
    if (fs.existsSync(SNAPSHOT_FILE)) {
      const data = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf-8"));
      lastHolidaySnapshot = data.records || {};
      logHoliday(`📁 Snapshot loaded (${Object.keys(lastHolidaySnapshot).length})`);
    }
  } catch (e) {
    logHoliday(`⚠️ Snapshot load failed: ${e.message}`);
  }
}

function saveSnapshot(records) {
  try {
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify({ records }, null, 2));
  } catch (e) {
    logHoliday(`⚠️ Snapshot save failed: ${e.message}`);
  }
}

// ======================================================
// 📆 Fetch holidays
// ======================================================
async function fetchHolidays() {
  const [rows] = await db.query("SELECT holiday_id, holiday_date FROM holiday ORDER BY holiday_id ASC");
  return rows.map((r) => dayjs(r.holiday_date).format("YYYY-MM-DD"));
}

// ======================================================
// 🔄 Update due_date saat holiday berubah
// ======================================================
async function updateDueDatesForChange(changedDates, holidays) {
  logHoliday(`📅 Holiday changed: ${changedDates.join(", ")}`);
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();
    const [countRows] = await conn.query("SELECT COUNT(*) AS total FROM loan WHERE is_lent=1 AND is_return=0");
    const total = countRows[0].total;
    logHoliday(`📊 Found ${total} active loans`);

    if (total === 0) {
      await conn.commit();
      conn.release();
      return;
    }

    let updatedCount = 0;
    for (let offset = 0; offset < total; offset += CHUNK_SIZE) {
      const [batch] = await conn.query(
        `SELECT loan_id, loan_date, due_date, loan_rules_id FROM loan 
         WHERE is_lent=1 AND is_return=0 LIMIT ? OFFSET ?`,
        [CHUNK_SIZE, offset]
      );

      const promises = batch.map(async (loan) => {
        const [[rule]] = await conn.query(
          "SELECT loan_periode FROM mst_loan_rules WHERE loan_rules_id=?",
          [loan.loan_rules_id]
        );
        if (!rule) return;

        const newDue = calculateDueDate(loan.loan_date, rule.loan_periode, holidays);
        if (newDue !== loan.due_date) {
          await conn.query("UPDATE loan SET due_date=?, last_update=NOW() WHERE loan_id=?", [newDue, loan.loan_id]);
          updatedCount++;
        }
      });

      await Promise.all(promises);
    }

    await conn.commit();
    logHoliday(`✅ ${updatedCount} loans updated due to holiday change`);
    fineEmitter.emit("dueDateChanged");
  } catch (e) {
    await conn.rollback();
    logHoliday(`❌ Update failed: ${e.message}`);
  } finally {
    conn.release();
  }
}

// ======================================================
// 💰 Live Fine Recalculation Service
// ======================================================
async function recalcFines() {
  logFine("💰 Starting fine recalculation...");

  try {
    const holidays = await fetchHolidays();
    const today = dayjs().tz().format("YYYY-MM-DD");
    logFine(`📅 Today: ${today}, Holidays loaded: ${holidays.length}`);

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
    logFine(`❌ Fine recalculation failed: ${err.message}`);
    logFine(`Stack: ${err.stack}`);
  }
}

// ======================================================
// 🔍 Detect Holiday Delta
// ======================================================
async function detectHolidayDelta() {
  const [rows] = await db.query("SELECT holiday_id, holiday_date FROM holiday ORDER BY holiday_id ASC");
  const current = Object.fromEntries(rows.map((r) => [String(r.holiday_id), dayjs(r.holiday_date).format("YYYY-MM-DD")]));

  const oldIds = new Set(Object.keys(lastHolidaySnapshot));
  const newIds = new Set(Object.keys(current));

  const inserted = [...newIds].filter((id) => !oldIds.has(id));
  const deleted = [...oldIds].filter((id) => !newIds.has(id));
  const updated = [...newIds].filter((id) => oldIds.has(id) && lastHolidaySnapshot[id] !== current[id]);

  if (inserted.length === 0 && deleted.length === 0 && updated.length === 0) {
    logHoliday("🕒 No holiday change detected.");
    return;
  }

  const changedDates = [
    ...inserted.map((id) => current[id]),
    ...updated.map((id) => current[id]),
  ];

  await updateDueDatesForChange(changedDates, Object.values(current));
  lastHolidaySnapshot = current;
  saveSnapshot(current);
}

// ======================================================
// 🚀 Start Service
// ======================================================
(async function startMonitor() {
  logHoliday("🚀 Integrated Live Monitor started (Holiday + Fine + Schedule)");

  loadSnapshot();

  // Event-driven recalculation (holiday changed)
  fineEmitter.on("dueDateChanged", async () => {
    try {
      await recalcFines();
    } catch (e) {
      logFine(`❌ Fine recalculation error: ${e.message}`);
    }
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

  // Polling for holiday delta every 30s
  setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await detectHolidayDelta();
    } catch (e) {
      logHoliday(`❌ Holiday monitor loop error: ${e.message}`);
    } finally {
      isRunning = false;
    }
  }, POLL_INTERVAL);
})();
