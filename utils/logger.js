// ======================================================
// utils/logger.js
//  centralized logging utility
// ======================================================

const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Jakarta");

// ======================================================
// ⚙️ KONFIGURASI
// ======================================================
const LOG_DIR = path.join(__dirname, "../logs");
const MAX_LOG_LINES = 1000; // maksimal baris log sebelum trim

// ======================================================
// 🧩 PASTIKAN FOLDER LOG ADA
// ======================================================
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  console.log(`📁 Folder log dibuat: ${LOG_DIR}`);
}

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

function log(logFile, prefix, msg, isError = false, toConsole = false) {
    const logFilePath = path.join(LOG_DIR, logFile);
    if (!fs.existsSync(logFilePath)) {
        fs.writeFileSync(logFilePath, "");
    }
    const finalPrefix = isError ? "❌" : prefix;
    const line = `[${ts()}] ${finalPrefix} ${msg}`;
    appendAndTrim(logFilePath, line);
    if (toConsole) {
        console.log(line);
    }
}

function logSeparator(logFunc) {
    logFunc("=".repeat(80));
}

// ======================================================
// 🏭 LOGGER FACTORY
// ======================================================
const logLevels = {
    INFO: "ℹ️",
    WARN: "⚠️",
    ERROR: "❌",
};

function createLogger(logFile, options = {}) {
    const { defaultPrefix = "", toConsole = false } = options;

    return function(msg, level = 'INFO') {
        const prefix = logLevels[level] || defaultPrefix;
        const isError = level === 'ERROR';
        log(logFile, prefix, msg, isError, toConsole);
    };
}

module.exports = {
    log,
    logSeparator,
    createLogger
};