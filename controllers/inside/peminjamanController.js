// controllers/inside/peminjamanController.js
const bcrypt = require('bcrypt');
const db = require('../../config/db'); // mysql2/promise pool
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const fs = require('fs');
const path = require('path');

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
    date = dayjs(); // fallback ke today jika parsing gagal
  }

  let daysAdded = 0;

  while (daysAdded < days) {
    date = date.add(1, 'day');
    const formatted = date.format('YYYY-MM-DD');
    
    // Skip jika hari Minggu (day() === 0) atau tanggal libur
    if (date.day() !== 0 && !holidays.includes(formatted)) {
      daysAdded++;
    }
  }

  return date.format('YYYY-MM-DD');
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

      console.log(`📁 Menggunakan snapshot holiday versi baru, total: ${holidays.length}`);
      return holidays;
    }
  } catch (err) {
    console.warn('⚠️ Gagal membaca snapshot holiday:', err.message);
  }

  // 🔁 Fallback ke DB kalau snapshot tidak valid
  const [holidayRows] = await connection.query('SELECT holiday_date FROM holiday');
  const holidays = holidayRows
    .map(row => {
      const parsed = dayjs(row.holiday_date, ["YYYY-MM-DD", "DD-MM-YYYY", "MM-DD-YYYY"], true);
      return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null;
    })
    .filter(date => date !== null);

  console.log(`📅 Snapshot tidak ditemukan, ambil dari DB: ${holidays.length}`);
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
  // Validasi session pustakawan
  if (!req.session.user || req.session.user.role !== 'pustakawan') {
    return res.redirect('/login');
  }

  res.render('inside/peminjaman', {
    user: req.session.user,
    popup: null
  });
};

// =====================================================
// 🔍 POST /inside/peminjaman/find
// Mencari dan memvalidasi buku berdasarkan item_code
// =====================================================
exports.findBook = async (req, res) => {
  try {
    // 1️⃣ Validasi session pustakawan
    if (!req.session.user || req.session.user.role !== 'pustakawan') {
      return res.status(401).json({
        success: false,
        type: 'error',
        title: 'Unauthorized',
        message: 'Silakan login sebagai pustakawan terlebih dahulu.'
      });
    }

    const { item_code } = req.body;

    // 2️⃣ Validasi input
    if (!item_code || item_code.trim() === '') {
      return res.status(400).json({
        success: false,
        type: 'warning',
        title: 'Input Tidak Valid',
        message: 'Kode buku tidak boleh kosong.'
      });
    }

    // 3️⃣ Query buku dengan JOIN ke biblio & mst_item_status
    const [rows] = await db.query(`
      SELECT 
        i.item_id,
        i.item_code,
        i.biblio_id,
        i.item_status_id,
        i.coll_type_id,
        i.location_id,
        b.title,
        b.sor AS author,
        b.publish_year,
        b.image,
        b.collation,
        b.language_id,
        b.publisher_id,
        ms.item_status_name,
        ms.no_loan
      FROM item i
      LEFT JOIN biblio b ON i.biblio_id = b.biblio_id
      LEFT JOIN mst_item_status ms ON i.item_status_id = ms.item_status_id
      WHERE i.item_code = ?
    `, [item_code.trim()]);

    // ❌ Buku tidak ditemukan di database
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        type: 'error',
        title: 'Buku Tidak Ditemukan',
        message: 'Kode buku tidak ditemukan di sistem. Pastikan kode yang Anda masukkan benar.'
      });
    }

    const book = rows[0];
    const status = book.item_status_id;

    // =====================================================
    // 🚫 Validasi Status Buku
    // =====================================================

    // 🔴 Status MIS: Buku hilang
    if (status === 'MIS') {
      return res.status(400).json({
        success: false,
        type: 'error',
        title: 'Buku Hilang',
        message: 'Buku ini berstatus hilang dan tidak dapat dipinjam.'
      });
    }

    // 🔴 Status NL: Non-lending (baca di tempat)
    if (status === 'NL') {
      return res.status(400).json({
        success: false,
        type: 'warning',
        title: 'Buku Tidak Dapat Dipinjam',
        message: 'Buku ini hanya bisa dibaca di perpustakaan dan tidak dapat dipinjam.'
      });
    }

    // 🔴 Status R: Rusak
    if (status === 'R') {
      return res.status(400).json({
        success: false,
        type: 'warning',
        title: 'Buku Rusak',
        message: 'Buku ini berstatus rusak dan tidak dapat dipinjam saat ini.'
      });
    }

    // 🔴 Status DEL: Deleted
    if (status === 'DEL') {
      return res.status(400).json({
        success: false,
        type: 'error',
        title: 'Buku Dihapus',
        message: 'Buku ini telah dihapus dari sistem dan tidak dapat dipinjam.'
      });
    }

    // 🔴 Cek apakah buku sedang dipinjam (status PT atau cek loan aktif)
    const [loanRows] = await db.query(`
      SELECT l.loan_id, l.member_id, m.member_name
      FROM loan l
      LEFT JOIN member m ON l.member_id = m.member_id
      WHERE l.item_code = ? 
        AND l.is_lent = 1 
        AND l.is_return = 0
      ORDER BY l.loan_date DESC
      LIMIT 1
    `, [item_code.trim()]);

    if (loanRows.length > 0) {
      const borrower = loanRows[0];
      return res.status(400).json({
        success: false,
        type: 'warning',
        title: 'Buku Sedang Dipinjam',
        message: `Buku ini sedang dipinjam oleh <strong>${borrower.member_name}</strong> (ID: ${borrower.member_id}).<br>Harap kembalikan buku terlebih dahulu.`
      });
    }

    // 🔴 Validasi no_loan dari mst_item_status (1 = tidak bisa dipinjam)
    if (book.no_loan === 1) {
      return res.status(400).json({
        success: false,
        type: 'warning',
        title: 'Buku Tidak Dapat Dipinjam',
        message: `Buku dengan status "${book.item_status_name || status}" tidak dapat dipinjam.`
      });
    }

    // ✅ Status valid untuk dipinjam: 0 (tersedia), PT (tapi tidak ada loan aktif)
    if (!['0', 'PT'].includes(status)) {
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

    // Cek cover image
    let coverImage = '/images/buku.png'; // default fallback
    if (book.image) {
      const imagePath = path.join(__dirname, '../../public', book.image);
      if (fs.existsSync(imagePath)) {
        coverImage = `/${book.image}`;
      }
    }

    return res.status(200).json({
      success: true,
      type: 'success',
      title: 'Buku Ditemukan',
      message: 'Buku tersedia dan siap untuk dipinjam.',
      book: {
        item_code: book.item_code,
        item_id: book.item_id,
        biblio_id: book.biblio_id,
        coll_type_id: book.coll_type_id,
        location_id: book.location_id,
        title: book.title || 'Judul tidak tersedia',
        author: book.author || 'Penulis tidak diketahui',
        publish_year: book.publish_year || '-',
        collation: book.collation || '-',
        language_id: book.language_id,
        publisher_id: book.publisher_id,
        cover: coverImage,
        status: status
      }
    });

  } catch (err) {
    console.error('❌ Error saat mencari buku:', err);
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
  
  try {
    // =====================================================
    // 1️⃣ Validasi Session Pustakawan
    // =====================================================
    if (!req.session.user || req.session.user.role !== 'pustakawan') {
      return res.status(401).json({
        success: false,
        type: 'error',
        title: 'Unauthorized',
        message: 'Hanya pustakawan yang dapat melakukan transaksi ini.'
      });
    }

    const { item_code, borrower_id, borrower_password } = req.body;

    // =====================================================
    // 2️⃣ Validasi Input
    // =====================================================
    if (!item_code || !borrower_id || !borrower_password) {
      return res.status(400).json({
        success: false,
        type: 'warning',
        title: 'Data Tidak Lengkap',
        message: 'Semua field wajib diisi: Kode Buku, ID Anggota, dan Password.'
      });
    }

    // Start transaction
    await connection.beginTransaction();

    // =====================================================
    // 3️⃣ Cek Buku di Database (Double Check)
    // =====================================================
    const [itemRows] = await connection.query(`
      SELECT 
        i.item_id,
        i.item_code,
        i.biblio_id,
        i.item_status_id,
        i.coll_type_id,
        i.location_id,
        b.title,
        b.sor AS author,
        b.publish_year,
        b.image,
        b.collation,
        b.language_id,
        b.publisher_id
      FROM item i
      LEFT JOIN biblio b ON i.biblio_id = b.biblio_id
      WHERE i.item_code = ?
    `, [item_code.trim()]);

    if (itemRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        type: 'error',
        title: 'Buku Tidak Ditemukan',
        message: 'Kode buku tidak ditemukan di sistem.'
      });
    }

    const book = itemRows[0];

    // =====================================================
    // 4️⃣ Validasi Akun Anggota (Member)
    // =====================================================
    const [memberRows] = await connection.query(
      'SELECT * FROM member WHERE member_id = ?',
      [borrower_id.trim()]
    );

    if (memberRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        type: 'error',
        title: 'Anggota Tidak Ditemukan',
        message: 'ID anggota tidak ditemukan di sistem.'
      });
    }

    const member = memberRows[0];

    // 🔒 Validasi password member (support bcrypt & plaintext)
    let isPasswordCorrect = false;
    if (
      typeof member.mpasswd === 'string' &&
      (member.mpasswd.startsWith('$2a$') ||
        member.mpasswd.startsWith('$2b$') ||
        member.mpasswd.startsWith('$2y$'))
    ) {
      // Password terenkripsi dengan bcrypt
      isPasswordCorrect = await bcrypt.compare(borrower_password, member.mpasswd);
    } else {
      // Password plaintext
      isPasswordCorrect = borrower_password === member.mpasswd;
    }

    if (!isPasswordCorrect) {
      await connection.rollback();
      return res.status(401).json({
        success: false,
        type: 'error',
        title: 'Password Salah',
        message: 'Password yang Anda masukkan tidak sesuai.'
      });
    }

    // =====================================================
    // 🆕 Validasi Denda (Member dengan denda aktif tidak boleh meminjam)
    // =====================================================
    const [fineRows] = await connection.query(
      'SELECT SUM(debet - credit) AS total_denda FROM fines WHERE member_id = ?',
      [member.member_id]
    );
    const totalFine = fineRows[0].total_denda || 0;

    if (totalFine > 0) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        type: 'warning',
        title: 'Masih Ada Denda',
        message: `Anggota masih memiliki denda sebesar Rp ${totalFine.toLocaleString('id-ID')}. Harap lunasi terlebih dahulu sebelum meminjam buku.`
      });
    }

    // 📅 Cek keanggotaan expired
    const today = dayjs().format('YYYY-MM-DD');
    if (member.expire_date && dayjs(member.expire_date).isBefore(today)) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        type: 'warning',
        title: 'Keanggotaan Kedaluwarsa',
        message: 'Keanggotaan telah kedaluwarsa. Silakan perpanjang keanggotaan terlebih dahulu.'
      });
    }

    // =====================================================
    // 5️⃣ Ambil Aturan Peminjaman (mst_loan_rules)
    // =====================================================
    const [rulesRows] = await connection.query(`
      SELECT * FROM mst_loan_rules
      WHERE member_type_id = ? AND coll_type_id = ?
      LIMIT 1
    `, [member.member_type_id, book.coll_type_id]);

    if (rulesRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        type: 'error',
        title: 'Aturan Tidak Ditemukan',
        message: 'Aturan peminjaman untuk tipe anggota dan koleksi ini tidak ditemukan. Hubungi administrator.'
      });
    }

    const loanRule = rulesRows[0];

    // =====================================================
    // 🆕 6️⃣ Validasi Batas Peminjaman Per Tipe Koleksi
    // =====================================================
    
    // Hitung jumlah buku aktif yang sedang dipinjam untuk coll_type_id yang sama
    const [collTypeCountRows] = await connection.query(`
      SELECT COUNT(*) as total
      FROM loan l
      INNER JOIN item i ON l.item_code = i.item_code
      WHERE l.member_id = ? 
        AND i.coll_type_id = ? 
        AND l.is_return = 0
    `, [member.member_id, book.coll_type_id]);

    const currentCollTypeLoans = collTypeCountRows[0].total;

    // Cek apakah sudah mencapai loan_limit untuk tipe koleksi ini
    if (currentCollTypeLoans >= loanRule.loan_limit) {
      // Ambil nama tipe koleksi untuk pesan error
      const [collTypeRows] = await connection.query(
        'SELECT coll_type_name FROM mst_coll_type WHERE coll_type_id = ?',
        [book.coll_type_id]
      );
      const collTypeName = collTypeRows.length > 0 ? collTypeRows[0].coll_type_name : 'tipe ini';

      await connection.rollback();
      return res.status(400).json({
        success: false,
        type: 'warning',
        title: 'Batas Peminjaman Tercapai',
        message: `Kamu telah mencapai maksimal peminjaman untuk tipe buku ${collTypeName} ini. Segera kembalikan terlebih dahulu buku yang kamu pinjam.`
      });
    }

    // =====================================================
    // 7️⃣ Validasi Total Batas Peminjaman Keseluruhan
    // =====================================================
    
    // Ambil semua aturan untuk member_type_id ini
    const [allRulesRows] = await connection.query(
      'SELECT loan_limit FROM mst_loan_rules WHERE member_type_id = ?',
      [member.member_type_id]
    );

    // Hitung total maksimum dari semua loan_limit
    const totalMaxLoans = allRulesRows.reduce((sum, rule) => sum + (rule.loan_limit || 0), 0);

    // Hitung total buku yang sedang dipinjam (semua tipe koleksi)
    const [totalCountRows] = await connection.query(`
      SELECT COUNT(*) as total
      FROM loan
      WHERE member_id = ? AND is_return = 0
    `, [member.member_id]);

    const currentTotalLoans = totalCountRows[0].total;

    // Cek apakah sudah mencapai batas total keseluruhan
    if (currentTotalLoans >= totalMaxLoans) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        type: 'warning',
        title: 'Batas Peminjaman Total Tercapai',
        message: `Kamu telah mencapai batas maksimum total peminjaman (${totalMaxLoans} buku). Harap kembalikan buku terlebih dahulu.`
      });
    }

    // =====================================================
    // 8️⃣ Ambil Data Hari Libur (Holiday) - BLACKLIST
    // =====================================================
    const holidays = await loadHolidays(connection);

    // =====================================================
    // 9️⃣ Hitung Due Date (Skip Minggu & Holidays)
    // =====================================================
    const loanDate = dayjs().format('YYYY-MM-DD');
    const dueDate = calculateDueDate(loanDate, loanRule.loan_periode, holidays);

    console.log(`📅 Loan Date: ${loanDate}, Due Date: ${dueDate} (${loanRule.loan_periode} hari kerja)`);

    // =====================================================
    // 🔟 Ambil UID Pustakawan dari Session
    // =====================================================
    const librarianUID = req.session.user.id || null; // username dari tabel user

    if (!librarianUID) {
      await connection.rollback();
      return res.status(401).json({
        success: false,
        type: 'error',
        title: 'Session Tidak Valid',
        message: 'Session pustakawan tidak ditemukan. Silakan login ulang.'
      });
    }

    console.log(`👤 Pustakawan UID: ${librarianUID}`);

    // =====================================================
    // 1️⃣1️⃣ Insert Transaksi ke Tabel Loan
    // =====================================================
    await connection.query(`
      INSERT INTO loan (
        member_id, item_code, loan_date, due_date, renewed,
        loan_rules_id, is_lent, is_return, input_date, last_update, uid
      )
      VALUES (?, ?, ?, ?, 0, ?, 1, 0, NOW(), NOW(), ?)
    `, [
      member.member_id,
      item_code.trim(),
      loanDate,
      dueDate,
      loanRule.loan_rules_id,
      librarianUID // UID pustakawan dari session
    ]);

    console.log(`✅ Transaksi peminjaman berhasil disimpan (UID: ${librarianUID})`);

    // ⚠️ TIDAK MENGUBAH item_status_id (sesuai instruksi)
    // Status buku tetap seperti semula, kontrol hanya dari tabel loan

    // Commit transaction
    await connection.commit();

    // =====================================================
    // 1️⃣2️⃣ Ambil Data Tambahan untuk Struk
    // =====================================================

    // Get language name
    let languageName = '-';
    if (book.language_id) {
      const [langRows] = await connection.query(
        'SELECT language_name FROM mst_language WHERE language_id = ?',
        [book.language_id]
      );
      if (langRows.length > 0) languageName = langRows[0].language_name;
    }

    // Get publisher name
    let publisherName = '-';
    if (book.publisher_id) {
      const [pubRows] = await connection.query(
        'SELECT publisher_name FROM mst_publisher WHERE publisher_id = ?',
        [book.publisher_id]
      );
      if (pubRows.length > 0) publisherName = pubRows[0].publisher_name;
    }

    // Get location name
    let locationName = '-';
    if (book.location_id) {
      const [locRows] = await connection.query(
        'SELECT location_name FROM mst_location WHERE location_id = ?',
        [book.location_id]
      );
      if (locRows.length > 0) locationName = locRows[0].location_name;
    }

    // Get collection type name
    let collTypeName = '-';
    if (book.coll_type_id) {
      const [collRows] = await connection.query(
        'SELECT coll_type_name FROM mst_coll_type WHERE coll_type_id = ?',
        [book.coll_type_id]
      );
      if (collRows.length > 0) collTypeName = collRows[0].coll_type_name;
    }

    // Get member type name (HANYA member_type_id dan member_type_name)
    let memberTypeName = '-';
    if (member.member_type_id) {
      const [mtRows] = await connection.query(
        'SELECT member_type_id, member_type_name FROM mst_member_type WHERE member_type_id = ?',
        [member.member_type_id]
      );
      if (mtRows.length > 0) memberTypeName = mtRows[0].member_type_name;
    }

    // =====================================================
    // 1️⃣3️⃣ Parse Collation (Pisah Edisi, Halaman, Ukuran)
    // =====================================================
    const { edition, pages, size } = parseCollation(book.collation);

    // =====================================================
    // 1️⃣4️⃣ Cek Cover Image
    // =====================================================
    let coverImage = '/images/buku.png';
    if (book.image) {
      const imagePath = path.join(__dirname, '../../public', book.image);
      if (fs.existsSync(imagePath)) {
        coverImage = `/${book.image}`;
      }
    }

    // =====================================================
    // ✅ Return Success Response dengan Data Struk
    // =====================================================
    return res.status(200).json({
      success: true,
      type: 'success',
      title: 'Peminjaman Berhasil',
      message: 'Transaksi peminjaman berhasil dilakukan.',
      receipt: {
        // Book Info
        book_title: book.title || 'Judul tidak tersedia',
        author: book.author || 'Penulis tidak diketahui',
        publish_year: book.publish_year || '-',
        collation: book.collation || '-',
        collation_pages: pages || '-',
        collation_size: size || '-',
        language: languageName,
        publisher: publisherName,
        location: locationName,
        coll_type: collTypeName,
        item_code: book.item_code,
        cover: coverImage,

        // Member Info
        member_name: member.member_name,
        member_id: member.member_id,
        member_type: memberTypeName,

        // Loan Info
        loan_date: loanDate,
        due_date: dueDate,
        loan_periode: loanRule.loan_periode,
        reborrow_limit: loanRule.reborrow_limit,
        fine_each_day: loanRule.fine_each_day,

        // Librarian Info
        librarian_name: req.session.user.realname || req.session.user.id,
        librarian_uid: librarianUID
      }
    });

  } catch (err) {
    await connection.rollback();
    console.error('❌ Error saat proses peminjaman:', err);
    return res.status(500).json({
      success: false,
      type: 'error',
      title: 'Kesalahan Server',
      message: 'Terjadi kesalahan pada server. Silakan coba lagi.'
    });
  } finally {
    connection.release();
  }
};

// =====================================================
// 📄 GET /inside/strukPinjam
// Render halaman struk peminjaman
// =====================================================
exports.renderStrukPinjam = (req, res) => {
  // Validasi session pustakawan
  if (!req.session.user || req.session.user.role !== 'pustakawan') {
    return res.redirect('/login');
  }

  try {
    // Ambil data receipt dari query string
    const receiptData = req.query.data;
    
    if (!receiptData) {
      return res.redirect('/inside/peminjaman');
    }

    // Parse JSON data
    const receipt = JSON.parse(decodeURIComponent(receiptData));

    // Render struk
    res.render('inside/strukPinjam', {
      user: req.session.user,
      receipt: receipt
    });

  } catch (err) {
    console.error('❌ Error saat render struk:', err);
    return res.redirect('/inside/peminjaman');
  }
};

// =====================================================
// 🧮 EXPORT HELPER FUNCTIONS UNTUK DIGUNAKAN DI LUAR 
// =====================================================
module.exports.calculateDueDate = calculateDueDate;
module.exports.loadHolidays = loadHolidays;