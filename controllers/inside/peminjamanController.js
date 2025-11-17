// controllers/inside/peminjamanController.js
const bcrypt = require('bcrypt');
const db = require('../../config/db'); // mysql2/promise pool
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../../utils/logger');

// Inisialisasi logger khusus untuk peminjaman
const logPeminjaman = createLogger('peminjaman.log');


// =====================================================
// 🧮 HELPER: Calculate Due Date (Skip Minggu & Holidays)
// =====================================================
/**
 * Menghitung tanggal jatuh tempo berdasarkan loan_periode
 * dengan skip hari Minggu dan tanggal di tabel holiday
 * 
 * @param {string} startDate - Format: YYYY-MM-DD, DD-MM-YYYY, atau MM-DD-YYYY
 * @param {number} days - Jumlah hari peminjaman dari loan_periode
 * @param {Array<string>} holidays - Array tanggal libur format YYYY-MM-DD
 * @returns {string} - Tanggal jatuh tempo format YYYY-MM-DD
 */
function calculateDueDate(startDate, days, holidays = []) {
  // Parse dengan multiple format untuk fleksibilitas
  let date = dayjs(startDate, ["YYYY-MM-DD", "DD-MM-YYYY", "MM-DD-YYYY"], true);
  
  // Validasi parsing
  if (!date.isValid()) {
    logPeminjaman(`calculateDueDate: Format tanggal tidak valid "${startDate}", menggunakan hari ini sebagai fallback`, 'WARN');
    date = dayjs(); // fallback ke today jika parsing gagal
  }

  logPeminjaman(`calculateDueDate MULAI: startDate=${startDate}, days=${days}, holidays=${holidays.length}`, 'INFO');
  let daysAdded = 0;
  let iterations = 0;
  const maxIterations = 365; // Safety limit

  while (daysAdded < days && iterations < maxIterations) {
    iterations++;
    date = date.add(1, 'day');
    const formatted = date.format('YYYY-MM-DD');
    const dayOfWeek = date.day(); // 0 = Sunday, 6 = Saturday
    const isHoliday = holidays.includes(formatted);
    
    // Skip jika hari Minggu (day() === 0) atau tanggal libur
    if (dayOfWeek !== 0 && !isHoliday) {
      daysAdded++;
    } else {
      const reason = dayOfWeek === 0 ? 'Sunday' : 'Holiday';
      logPeminjaman(`calculateDueDate: Melewatkan ${formatted} (${date.format('ddd')}) - ${reason}`, 'DEBUG');
    }
  }

  const result = date.format('YYYY-MM-DD');
  logPeminjaman(`calculateDueDate SELESAI: Hasil=${result} after ${iterations} iterasi`, 'INFO');
  
  return result;
}

// =====================================================
// 🧮 HELPER: Load Holidays (From Snapshot or DB)
// =====================================================
/**
 * Mengambil daftar hari libur dari snapshot versi baru atau database
 * Format snapshot baru: { "id": "YYYY-MM-DD", ... }
 * 
 * @param {Object} connection - MySQL connection object
 * @returns {Promise<Array<string>>} - Array tanggal libur format YYYY-MM-DD
 */
async function loadHolidays(connection) {
  logPeminjaman('loadHolidays: Mencoba memuat hari libur dari snapshot.', 'INFO');
  try {
    const snapshotPath = path.join(__dirname, '../../logs/holiday-snapshot.json');

    if (fs.existsSync(snapshotPath)) {
      const snapshotData = fs.readFileSync(snapshotPath, 'utf8');
      const snapshot = JSON.parse(snapshotData);

      let holidaysObj = {};

      // ✅ Deteksi versi baru (ada key "records")
      if (snapshot.records && typeof snapshot.records === 'object') {
        holidaysObj = snapshot.records;
      } else if (typeof snapshot === 'object') {
        holidaysObj = snapshot;
      }

      const holidays = Object.values(holidaysObj)
        .map(date => {
          const parsed = dayjs(date, ["YYYY-MM-DD", "DD-MM-YYYY", "MM-DD-YYYY"], true);
          return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null;
        })
        .filter(date => date !== null);

      logPeminjaman(`loadHolidays: Berhasil memuat ${holidays.length} hari libur dari snapshot.`, 'INFO');
      return holidays;
    }
  } catch (err) {
    logPeminjaman(`loadHolidays: Gagal membaca atau mem-parsing snapshot hari libur. Kesalahan: ${err.message}`, 'WARN');
  }

  // 🔁 Fallback ke DB kalau snapshot tidak valid
  logPeminjaman('loadHolidays: Snapshot tidak ditemukan atau tidak valid, kembali ke database.', 'INFO');
  const [holidayRows] = await connection.query('SELECT holiday_date FROM holiday');
  const holidays = holidayRows
    .map(row => {
      const parsed = dayjs(row.holiday_date, ["YYYY-MM-DD", "DD-MM-YYYY", "MM-DD-YYYY"], true);
      return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null;
    })
    .filter(date => date !== null);

  logPeminjaman(`loadHolidays: Memuat ${holidays.length} hari libur dari database.`, 'INFO');
  return holidays;
}

// =====================================================
// 🧮 HELPER: Parse Collation
// =====================================================
/**
 * Memisahkan informasi collation menjadi edition, pages, dan size
 * @param {string} collation - String collation dari biblio
 * @returns {Object} - { edition, pages, size }
 */
function parseCollation(collation) {
  let edition = null;
  let pages = null;
  let size = null;

  if (collation) {
    const collationTrimmed = collation.trim();

    // 1. Deteksi Edisi (angka romawi di awal atau Ed./Cet.)
    const editionMatch = collationTrimmed.match(/^([ivxlcdm]+)\s*,?/i) || 
                        collationTrimmed.match(/(?:ed\.?|cet\.?)\s*(\d+)/i);
    if (editionMatch) {
      edition = editionMatch[1].toUpperCase();
    }

    // 2. Deteksi Jumlah Halaman (hal. atau hlm.)
    const pagesMatch = collationTrimmed.match(/(\d+)\s*(?:hal\.?|hlm\.?)/i);
    if (pagesMatch) {
      pages = `${pagesMatch[1]} Halaman`;
    }

    // 3. Deteksi Ukuran (cm)
    const sizeMatch = collationTrimmed.match(/(\d+)\s*cm/i);
    if (sizeMatch) {
      size = `${sizeMatch[1]} cm`;
    }
  }

  return { edition, pages, size };
}

// =====================================================
// 🏠 GET /inside/peminjaman
// Render halaman utama kios peminjaman
// =====================================================
exports.renderPeminjaman = (req, res) => {
  const user = req.session.user;
  const ip = req.ip;
  logPeminjaman(`MULAI: renderPeminjaman untuk pengguna: ${user ? user.username : 'Tamu'} from IP: ${ip}`, 'INFO');

  // Validasi session pustakawan
  if (!user || user.role !== 'pustakawan') {
    logPeminjaman(`Akses tidak sah ke renderPeminjaman dari IP: ${ip}. Mengalihkan ke login.`, 'WARN');
    return res.redirect('/login');
  }

  logPeminjaman(`Merender halaman peminjaman untuk pustakawan: ${user.username}`, 'INFO');
  res.render('inside/peminjaman', {
    user: req.session.user,
    popup: null
  });
  logPeminjaman(`Berhasil merender halaman peminjaman untuk pustakawan: ${user.username}`, 'INFO');
};

// =====================================================
// 🔍 POST /inside/peminjaman/find
// Mencari dan memvalidasi buku berdasarkan item_code
// =====================================================
exports.findBook = async (req, res) => {
  const user = req.session.user;
  const ip = req.ip;
  const { item_code } = req.body;
  logPeminjaman(`MULAI: findBook untuk item_code: '${item_code}' oleh pengguna: ${user ? user.username : 'Tamu'} dari IP: ${ip}`, 'INFO');

  try {
    // 1️⃣ Validasi session pustakawan
    if (!user || user.role !== 'pustakawan') {
      logPeminjaman(`Upaya findBook yang tidak sah dari IP: ${ip}`, 'WARN');
      return res.status(401).json({
        success: false,
        type: 'error',
        title: 'Unauthorized',
        message: 'Silakan login sebagai pustakawan terlebih dahulu.'
      });
    }

    // 2️⃣ Validasi input
    if (!item_code || item_code.trim() === '') {
      logPeminjaman(`findBook gagal: item_code kosong dari IP: ${ip}`, 'WARN');
      return res.status(400).json({
        success: false,
        type: 'warning',
        title: 'Input Tidak Valid',
        message: 'Kode buku tidak boleh kosong.'
      });
    }

    // 3️⃣ Query buku dengan JOIN ke biblio & mst_item_status
    logPeminjaman(`Querying database for item_code: '${item_code.trim()}'`, 'INFO');
    const [rows] = await db.query(`
      SELECT 
        i.item_id, i.item_code, i.biblio_id, i.item_status_id, i.coll_type_id, i.location_id,
        b.title, b.sor AS author, b.publish_year, b.image, b.collation, b.language_id, b.publisher_id,
        ms.item_status_name, ms.no_loan
      FROM item i
      LEFT JOIN biblio b ON i.biblio_id = b.biblio_id
      LEFT JOIN mst_item_status ms ON i.item_status_id = ms.item_status_id
      WHERE i.item_code = ?
    `, [item_code.trim()]);

    // ❌ Buku tidak ditemukan di database
    if (rows.length === 0) {
      logPeminjaman(`findBook gagal: Item_code '${item_code.trim()}' tidak di temukan di database.`, 'WARN');
      return res.status(404).json({
        success: false,
        type: 'error',
        title: 'Buku Tidak Ditemukan',
        message: 'Kode buku tidak ditemukan di sistem. Pastikan kode yang Anda masukkan benar.'
      });
    }

    const book = rows[0];
    const status = book.item_status_id;
    logPeminjaman(`Buku ditemukan: '${book.title}' dengan status: '${status}'`, 'INFO');

    // =====================================================
    // 🚫 Validasi Status Buku
    // =====================================================
    const invalidStatusMap = {
      'MIS': { title: 'Buku Hilang', message: 'Buku ini berstatus hilang dan tidak dapat dipinjam.' },
      'NL': { title: 'Buku Tidak Dapat Dipinjam', message: 'Buku ini hanya bisa dibaca di perpustakaan dan tidak dapat dipinjam.' },
      'R': { title: 'Buku Rusak', message: 'Buku ini berstatus rusak dan tidak dapat dipinjam saat ini.' },
      'DEL': { title: 'Buku Dihapus', message: 'Buku ini telah dihapus dari sistem dan tidak dapat dipinjam.' }
    };

    if (invalidStatusMap[status]) {
      logPeminjaman(`findBook gagal: Status buku adalah '${status}' untuk item_code: '${item_code.trim()}'`, 'WARN');
      return res.status(400).json({ success: false, type: 'error', ...invalidStatusMap[status] });
    }

    // 🔴 Cek apakah buku sedang dipinjam (status PT atau cek loan aktif)
    const [loanRows] = await db.query(`
      SELECT l.loan_id, l.member_id, m.member_name
      FROM loan l
      LEFT JOIN member m ON l.member_id = m.member_id
      WHERE l.item_code = ? AND l.is_lent = 1 AND l.is_return = 0
      ORDER BY l.loan_date DESC LIMIT 1
    `, [item_code.trim()]);

    if (loanRows.length > 0) {
      const borrower = loanRows[0];
      logPeminjaman(`findBook gagal: Buku sudah dipinjamkan ke anggota '${borrower.member_id}'`, 'WARN');
      return res.status(400).json({
        success: false,
        type: 'warning',
        title: 'Buku Sedang Dipinjam',
        message: `Buku ini sedang dipinjam oleh <strong>${borrower.member_name}</strong> (ID: ${borrower.member_id}).<br>Harap kembalikan buku terlebih dahulu.`
      });
    }

    // 🔴 Validasi no_loan dari mst_item_status (1 = tidak bisa dipinjam)
    if (book.no_loan === 1) {
      logPeminjaman(`findBook gagal: Buku memiliki bendera 'no_loan' yang ditetapkan untuk item_code: '${item_code.trim()}'`, 'WARN');
      return res.status(400).json({
        success: false,
        type: 'warning',
        title: 'Buku Tidak Dapat Dipinjam',
        message: `Buku dengan status "${book.item_status_name || status}" tidak dapat dipinjam.`
      });
    }

    // ✅ Status valid untuk dipinjam: 0 (tersedia), PT (tapi tidak ada loan aktif)
    if (!['0', 'PT'].includes(status)) {
      logPeminjaman(`findBook gagal: Status tidak valid '${status}' untuk peminjaman item_code: '${item_code.trim()}'`, 'WARN');
      return res.status(400).json({
        success: false,
        type: 'warning',
        title: 'Status Tidak Valid',
        message: `Buku dengan status "${status}" tidak dapat dipinjam saat ini.`
      });
    }

    // =====================================================
    // ✅ Buku valid dan tersedia untuk dipinjam
    // =====================================================
    logPeminjaman(`Buku '${item_code.trim()}' valid untuk peminjaman.`, 'INFO');

    // Cek cover image
    let coverImage = '/images/buku.png'; // default fallback
    if (book.image && fs.existsSync(path.join(__dirname, '../../public', book.image))) {
      coverImage = `/${book.image}`;
    }

    return res.status(200).json({
      success: true,
      type: 'success',
      title: 'Buku Ditemukan',
      message: 'Buku tersedia dan siap untuk dipinjam.',
      book: {
        item_code: book.item_code, item_id: book.item_id, biblio_id: book.biblio_id,
        coll_type_id: book.coll_type_id, location_id: book.location_id,
        title: book.title || 'Judul tidak tersedia', author: book.author || 'Penulis tidak diketahui',
        publish_year: book.publish_year || '-', collation: book.collation || '-',
        language_id: book.language_id, publisher_id: book.publisher_id,
        cover: coverImage, status: status
      }
    });

  } catch (err) {
    logPeminjaman(`Kesalahan server dalam findBook untuk item_code '${item_code}': ${err.message}`, 'ERROR');
    return res.status(500).json({
      success: false,
      type: 'error',
      title: 'Kesalahan Server',
      message: 'Terjadi kesalahan pada server. Silakan coba lagi.'
    });
  }
};

// =====================================================
// 📚 POST /inside/api/kiosk/borrow
// Proses transaksi peminjaman buku
// =====================================================
exports.borrowBookAPI = async (req, res) => {
  const connection = await db.getConnection();
  const { item_code, borrower_id, borrower_password } = req.body;
  const user = req.session.user;
  const ip = req.ip;
  logPeminjaman(`MULAI: borrowBookAPI untuk item_code: '${item_code}', borrower_id: '${borrower_id}' oleh user: ${user ? user.username : 'Guest'} dari IP: ${ip}`, 'INFO');
  
  try {
    // 1️⃣ Validasi Session Pustakawan
    if (!user || user.role !== 'pustakawan') {
      logPeminjaman(`Upaya tidak sah borrowBookAPI mencoba dari IP: ${ip}`, 'WARN');
      return res.status(401).json({
        success: false, type: 'error', title: 'Unauthorized',
        message: 'Hanya pustakawan yang dapat melakukan transaksi ini.'
      });
    }

    // 2️⃣ Validasi Input
    if (!item_code || !borrower_id || !borrower_password) {
      logPeminjaman(`borrowBookAPI gagal: Kolom yang diperlukan tidak ada. item_code=${!!item_code}, borrower_id=${!!borrower_id}, password=${!!borrower_password}`, 'WARN');
      return res.status(400).json({
        success: false, type: 'warning', title: 'Data Tidak Lengkap',
        message: 'Semua field wajib diisi: Kode Buku, ID Anggota, dan Password.'
      });
    }

    await connection.beginTransaction();
    logPeminjaman('Transaksi database dimulai.', 'INFO');

    // 3️⃣ Cek Buku di Database (Double Check)
    const [itemRows] = await connection.query('SELECT i.*, b.title, b.sor AS author, b.publish_year, b.image, b.collation, b.language_id, b.publisher_id FROM item i LEFT JOIN biblio b ON i.biblio_id = b.biblio_id WHERE i.item_code = ?', [item_code.trim()]);
    if (itemRows.length === 0) {
      await connection.rollback();
      logPeminjaman(`borrowBookAPI gagal: Item_code '${item_code.trim()}' tidak ditemukan selama transaksi peminjaman.`, 'ERROR');
      return res.status(404).json({ success: false, type: 'error', title: 'Buku Tidak Ditemukan', message: 'Kode buku tidak ditemukan di sistem.' });
    }
    const book = itemRows[0];

    // 4️⃣ Validasi Akun Anggota (Member)
    const [memberRows] = await connection.query('SELECT * FROM member WHERE member_id = ?', [borrower_id.trim()]);
    if (memberRows.length === 0) {
      await connection.rollback();
      logPeminjaman(`borrowBookAPI gagal: Borrower_id '${borrower_id.trim()}' tidak ditemukan.`, 'WARN');
      return res.status(404).json({ success: false, type: 'error', title: 'Anggota Tidak Ditemukan', message: 'ID anggota tidak ditemukan di sistem.' });
    }
    const member = memberRows[0];

    // 🔒 Validasi password member
    const isPasswordCorrect = (typeof member.mpasswd === 'string' && member.mpasswd.match(/^\$2[aby]\$/))
      ? await bcrypt.compare(borrower_password, member.mpasswd)
      : borrower_password === member.mpasswd;

    if (!isPasswordCorrect) {
      await connection.rollback();
      logPeminjaman(`borrowBookAPI gagal: Password salah untuk borrower_id '${borrower_id.trim()}'.`, 'WARN');
      return res.status(401).json({ success: false, type: 'error', title: 'Password Salah', message: 'Password yang Anda masukkan tidak sesuai.' });
    }
    logPeminjaman(`Validasi password berhasil untuk anggota '${member.member_id}'`, 'INFO');

    // 5️⃣ Validasi Denda
    const [fineRows] = await connection.query('SELECT SUM(debet - credit) AS total_denda FROM fines WHERE member_id = ?', [member.member_id]);
    const totalFine = fineRows[0].total_denda || 0;
    if (totalFine > 0) {
      await connection.rollback();
      logPeminjaman(`borrowBookAPI gagal: Member '${member.member_id}' memiliki denda sebesar ${totalFine}.`, 'WARN');
      return res.status(403).json({ success: false, type: 'warning', title: 'Masih Ada Denda', message: `Anggota masih memiliki denda sebesar Rp ${totalFine.toLocaleString('id-ID')}. Harap lunasi terlebih dahulu.` });
    }

    // 📅 Cek keanggotaan expired
    const today = dayjs().format('YYYY-MM-DD');
    if (member.expire_date && dayjs(member.expire_date).isBefore(today)) {
      await connection.rollback();
      logPeminjaman(`borrowBookAPI gagal: Keanggotaan kedaluwarsa untuk anggota '${member.member_id}'. Tanggal kedaluwarsa: ${member.expire_date}`, 'WARN');
      return res.status(403).json({ success: false, type: 'warning', title: 'Keanggotaan Kedaluwarsa', message: 'Keanggotaan telah kedaluwarsa.' });
    }

    // 6️⃣ Ambil Aturan Peminjaman
    const [rulesRows] = await connection.query('SELECT * FROM mst_loan_rules WHERE member_type_id = ? AND coll_type_id = ? LIMIT 1', [member.member_type_id, book.coll_type_id]);
    if (rulesRows.length === 0) {
      await connection.rollback();
      logPeminjaman(`borrowBookAPI gagal: Aturan peminjaman tidak ditemukan untuk tipe anggota '${member.member_type_id}' dan tipe koleksi '${book.coll_type_id}'.`, 'ERROR');
      return res.status(400).json({ success: false, type: 'error', title: 'Aturan Tidak Ditemukan', message: 'Aturan peminjaman untuk tipe anggota dan koleksi ini tidak ditemukan.' });
    }
    const loanRule = rulesRows[0];
    logPeminjaman(`Aturan peminjaman ditemukan: loan_limit=${loanRule.loan_limit}, loan_periode=${loanRule.loan_periode}`, 'INFO');
    // 7️⃣ Validasi Batas Peminjaman
    const [collTypeCountRows] = await connection.query('SELECT COUNT(*) as total FROM loan l INNER JOIN item i ON l.item_code = i.item_code WHERE l.member_id = ? AND i.coll_type_id = ? AND l.is_return = 0', [member.member_id, book.coll_type_id]);
    const currentCollTypeLoans = collTypeCountRows[0].total;
    if (currentCollTypeLoans >= loanRule.loan_limit) {
      await connection.rollback();
      logPeminjaman(`borrowBookAPI gagal: Batas peminjaman tipe koleksi tercapai untuk anggota '${member.member_id}'. Batas: ${loanRule.loan_limit}, Saat ini: ${currentCollTypeLoans}`, 'WARN');
      return res.status(400).json({ success: false, type: 'warning', title: 'Batas Peminjaman Tercapai', message: `Batas peminjaman untuk tipe buku ini telah tercapai.` });
    }

    const [allRulesRows] = await connection.query('SELECT loan_limit FROM mst_loan_rules WHERE member_type_id = ?', [member.member_type_id]);
    const totalMaxLoans = allRulesRows.reduce((sum, rule) => sum + (rule.loan_limit || 0), 0);
    const [totalCountRows] = await connection.query('SELECT COUNT(*) as total FROM loan WHERE member_id = ? AND is_return = 0', [member.member_id]);
    const currentTotalLoans = totalCountRows[0].total;
    if (currentTotalLoans >= totalMaxLoans) {
      await connection.rollback();
      logPeminjaman(`borrowBookAPI gagal: Batas maksimum total peminjaman tercapai untuk anggota '${member.member_id}'. Batas: ${totalMaxLoans}, Saat ini: ${currentTotalLoans}`, 'WARN');
      return res.status(400).json({ success: false, type: 'warning', title: 'Batas Peminjaman Total Tercapai', message: `Batas maksimum total peminjaman (${totalMaxLoans} buku) telah tercapai.` });
    }
    logPeminjaman(`Validasi batas peminjaman berhasil untuk anggota '${member.member_id}'`, 'INFO');

    // 8️⃣ Hitung Due Date
    const holidays = await loadHolidays(connection);
    const loanDate = dayjs().format('YYYY-MM-DD');
    const dueDate = calculateDueDate(loanDate, loanRule.loan_periode, holidays);
    logPeminjaman(`Tanggal jatuh tempo dihitung: ${dueDate} dari tanggal pinjam: ${loanDate} dengan periode: ${loanRule.loan_periode}`, 'INFO');

    // 9️⃣ Insert Transaksi
    const librarianUID = user.id;
    await connection.query('INSERT INTO loan (member_id, item_code, loan_date, due_date, renewed, loan_rules_id, is_lent, is_return, input_date, last_update, uid) VALUES (?, ?, ?, ?, 0, ?, 1, 0, NOW(), NOW(), ?)', [member.member_id, item_code.trim(), loanDate, dueDate, loanRule.loan_rules_id, librarianUID]);
    logPeminjaman(`Transaksi peminjaman berhasil dimasukkan untuk item '${item_code.trim()}' oleh anggota '${member.member_id}'. Pustakawan: '${librarianUID}'`, 'INFO');

    await connection.commit();
    logPeminjaman('Transaksi database berhasil disimpan.', 'INFO');

//     // ✅ Ambil ID terakhir transaksi peminjaman
// const [lastLoanRows] = await connection.query(
//   "SELECT loan_id FROM loan WHERE member_id = ? ORDER BY loan_id DESC LIMIT 1",
//   [member.member_id]
// );
// const loanId = lastLoanRows[0]?.loan_id || null;

// // ✅ Simpan loanId ke session agar halaman struk bisa akses
// req.session.lastLoanId = loanId;
// logger(`Saved lastLoanId=${loanId} to session`, "INFO");


    // 🔟 Siapkan data struk
    const [langRows] = await connection.query('SELECT language_name FROM mst_language WHERE language_id = ?', [book.language_id]);
    const [pubRows] = await connection.query('SELECT publisher_name FROM mst_publisher WHERE publisher_id = ?', [book.publisher_id]);
    const [locRows] = await connection.query('SELECT location_name FROM mst_location WHERE location_id = ?', [book.location_id]);
    const [collRows] = await connection.query('SELECT coll_type_name FROM mst_coll_type WHERE coll_type_id = ?', [book.coll_type_id]);
    const [mtRows] = await connection.query('SELECT member_type_name FROM mst_member_type WHERE member_type_id = ?', [member.member_type_id]);
    const { edition, pages, size } = parseCollation(book.collation);
    let coverImage = '/images/buku.png';
    if (book.image && fs.existsSync(path.join(__dirname, '../../public', book.image))) {
      coverImage = `/${book.image}`;
    }

    // ✅ Return Success
    return res.status(200).json({
      success: true, type: 'success', title: 'Peminjaman Berhasil', message: 'Transaksi peminjaman berhasil dilakukan.',
      receipt: {
        book_title: book.title || 'N/A', author: book.author || 'N/A', publish_year: book.publish_year || '-',
        collation_pages: pages || '-', collation_size: size || '-', language: langRows[0]?.language_name || '-',
        publisher: pubRows[0]?.publisher_name || '-', location: locRows[0]?.location_name || '-',
        coll_type: collRows[0]?.coll_type_name || '-', item_code: book.item_code, cover: coverImage,
        member_name: member.member_name, member_id: member.member_id, member_type: mtRows[0]?.member_type_name || '-',
        loan_date: loanDate, due_date: dueDate, loan_periode: loanRule.loan_periode,
        reborrow_limit: loanRule.reborrow_limit, fine_each_day: loanRule.fine_each_day,
        librarian_name: user.realname || user.id, librarian_uid: librarianUID
      }
    });

  } catch (err) {
    await connection.rollback();
    logPeminjaman(`Kesalahan server di borrowBookAPI: ${err.message}`, 'ERROR');
    return res.status(500).json({ success: false, type: 'error', title: 'Kesalahan Server', message: 'Terjadi kesalahan pada server.' });
  } finally {
    connection.release();
    logPeminjaman('Koneksi database dilepaskan.', 'INFO');
  }
};

// =====================================================
// 📄 GET /inside/strukPinjam
// Render halaman struk peminjaman
// =====================================================
exports.renderStrukPinjam = (req, res) => {
  const user = req.session.user;
  const ip = req.ip;
  logPeminjaman(`MULAI: renderStrukPinjam untuk user: ${user ? user.username : 'Guest'} dari IP: ${ip}`, 'INFO');

  // Validasi session pustakawan
  if (!user || user.role !== 'pustakawan') {
    logPeminjaman(`Akses tidak sah ke renderStrukPinjam dari IP: ${ip}. Mengalihkan ke login.`, WARN);
    return res.redirect('/login');
  }

  try {
    const receiptData = req.query.data;
    if (!receiptData) {
      logPeminjaman('renderStrukPinjam gagal: Tidak ada data struk dalam query string. Mengalihkan ke halaman peminjaman.', 'WARN');
      return res.redirect('/inside/peminjaman');
    }

    const receipt = JSON.parse(decodeURIComponent(receiptData));
    logPeminjaman(`Merender struk untuk item_code: '${receipt.item_code}' dan member_id: '${receipt.member_id}'`, 'INFO');

    res.render('inside/strukPinjam', { user: req.session.user, receipt: receipt });
    logPeminjaman('Berhasil merender halaman struk.', 'INFO');

  } catch (err) {
    logPeminjaman(`Error saat render struk: ${err.message}`, 'ERROR');
    return res.redirect('/inside/peminjaman');
  }
};

// =====================================================
// 🧮 HELPER: Calculate Working Days Overdue (Skip Minggu & Holidays)
// =====================================================
/**
 * Menghitung jumlah hari kerja terlambat (skip Minggu & holiday)
 * 
 * @param {string} dueDate - Tanggal jatuh tempo (YYYY-MM-DD)
 * @param {string} currentDate - Tanggal sekarang (YYYY-MM-DD)
 * @param {Array<string>} holidays - Array tanggal libur format YYYY-MM-DD
 * @returns {number} - Jumlah hari kerja terlambat
 */
function calculateWorkingDaysOverdue(dueDate, currentDate, holidays = []) {
  const due = dayjs(dueDate);
  const current = dayjs(currentDate);
  
  if (current.isBefore(due) || current.isSame(due, 'day')) {
    return 0;
  }
  
  const totalDays = current.diff(due, 'day');
  let workingDays = 0;
  
  for (let i = 1; i <= totalDays; i++) {
    const checkDate = due.add(i, 'day');
    const formatted = checkDate.format('YYYY-MM-DD');
    const dayOfWeek = checkDate.day(); // 0 = Sunday
    
    if (dayOfWeek !== 0 && !holidays.includes(formatted)) {
      workingDays++;
    }
  }
  
  return workingDays;
}

// =====================================================
// 🧮 EXPORT HELPER FUNCTIONS UNTUK DIGUNAKAN DI LUAR 
// =====================================================
module.exports.calculateDueDate = calculateDueDate;
module.exports.loadHolidays = loadHolidays;
module.exports.calculateWorkingDaysOverdue = calculateWorkingDaysOverdue;
