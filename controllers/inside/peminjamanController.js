// controllers/inside/peminjamanController.js
const bcrypt = require('bcrypt');
const db = require('../../config/db'); // mysql2/promise pool
const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');

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
// Mencari buku berdasarkan item_code (scan barcode)
// =====================================================
exports.findBook = async (req, res) => {
  try {
    // Validasi session pustakawan
    if (!req.session.user || req.session.user.role !== 'pustakawan') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. Silakan login sebagai pustakawan.'
      });
    }

    const { item_code } = req.body;

    // Validasi input
    if (!item_code || item_code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Kode buku tidak boleh kosong.'
      });
    }

    // Query: JOIN item dengan biblio untuk mendapatkan info lengkap
    const [rows] = await db.query(`
      SELECT 
        i.item_id,
        i.item_code,
        i.biblio_id,
        i.item_status_id,
        b.title,
        b.sor,
        b.publish_year,
        b.image
      FROM item i
      LEFT JOIN biblio b ON i.biblio_id = b.biblio_id
      WHERE i.item_code = ?
    `, [item_code.trim()]);

    // ❌ Buku tidak ditemukan
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Kode buku tidak ditemukan di sistem.'
      });
    }

    const book = rows[0];
    const status = book.item_status_id;

    // =====================================================
    // 🚫 Validasi Status Buku
    // =====================================================

    // 🔴 Status PT: Sedang dipinjam
    if (status === 'PT') {
      // Cari peminjam aktif
      const [loanRows] = await db.query(`
        SELECT l.member_id, m.member_name
        FROM loan l
        LEFT JOIN member m ON l.member_id = m.member_id
        WHERE l.item_code = ? AND l.is_return = 0
        ORDER BY l.loan_date DESC
        LIMIT 1
      `, [item_code.trim()]);

      if (loanRows.length > 0) {
        const borrower = loanRows[0];
        return res.status(400).json({
          success: false,
          message: `Buku ini sedang dipinjam oleh <strong>${borrower.member_name}</strong> (NIM: ${borrower.member_id}).<br>Harap dikembalikan ke staf terlebih dahulu.`,
          statusType: 'borrowed'
        });
      } else {
        // Kalau tidak ada data loan tapi status PT (data corrupt)
        return res.status(400).json({
          success: false,
          message: 'Buku ini memiliki status sedang dipinjam, namun data peminjam tidak ditemukan. Harap hubungi administrator.',
          statusType: 'borrowed'
        });
      }
    }

    // 🔴 Status NL: Non-lending
    if (status === 'NL') {
      return res.status(400).json({
        success: false,
        message: 'Buku ini adalah koleksi <strong>non-lending</strong>, tidak dapat dipinjam.',
        statusType: 'non_lending'
      });
    }

    // ✅ Status valid untuk dipinjam: 0, R, MIS
    if (!['0', 'R', 'MIS'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Buku dengan status "${status}" tidak dapat dipinjam saat ini.`,
        statusType: 'unavailable'
      });
    }

    // =====================================================
    // ✅ Buku tersedia dan valid
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
      message: 'Buku ditemukan dan tersedia untuk dipinjam.',
      book: {
        item_code: book.item_code,
        title: book.title || 'Judul tidak tersedia',
        author: book.sor || 'Penulis tidak diketahui',
        publish_year: book.publish_year || '-',
        cover: coverImage,
        status: status
      }
    });

  } catch (err) {
    console.error('❌ Error saat mencari buku:', err);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server. Silakan coba lagi.'
    });
  }
};

// =====================================================
// 📚 POST /api/kiosk/borrow
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
        message: 'Unauthorized. Hanya pustakawan yang dapat melakukan transaksi ini.'
      });
    }

    const { item_code, borrower_nim, borrower_password } = req.body;

    // =====================================================
    // 2️⃣ Validasi Input
    // =====================================================
    if (!item_code || !borrower_nim || !borrower_password) {
      return res.status(400).json({
        success: false,
        message: 'Semua field wajib diisi: Kode Buku, NIM Peminjam, dan Password.'
      });
    }

    // Start transaction
    await connection.beginTransaction();

    // =====================================================
    // 3️⃣ Cek Buku di Database
    // =====================================================
    const [itemRows] = await connection.query(`
      SELECT 
        i.item_id,
        i.item_code,
        i.biblio_id,
        i.item_status_id,
        b.title,
        b.sor,
        b.publish_year,
        b.image
      FROM item i
      LEFT JOIN biblio b ON i.biblio_id = b.biblio_id
      WHERE i.item_code = ?
    `, [item_code.trim()]);

    if (itemRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Kode buku tidak ditemukan di sistem.'
      });
    }

    const book = itemRows[0];
    const status = book.item_status_id;

    // =====================================================
    // 4️⃣ Validasi Status Buku (Double Check)
    // =====================================================
    if (status === 'PT') {
      const [loanRows] = await connection.query(`
        SELECT l.member_id, m.member_name
        FROM loan l
        LEFT JOIN member m ON l.member_id = m.member_id
        WHERE l.item_code = ? AND l.is_return = 0
        ORDER BY l.loan_date DESC
        LIMIT 1
      `, [item_code.trim()]);

      await connection.rollback();

      if (loanRows.length > 0) {
        const borrower = loanRows[0];
        return res.status(400).json({
          success: false,
          message: `Buku ini sedang dipinjam oleh <strong>${borrower.member_name}</strong> (NIM: ${borrower.member_id}).`
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Buku memiliki status sedang dipinjam. Harap periksa data.'
        });
      }
    }

    if (status === 'NL') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Buku ini adalah koleksi non-lending, tidak dapat dipinjam.'
      });
    }

    if (!['0', 'R', 'MIS'].includes(status)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Buku dengan status "${status}" tidak dapat dipinjam.`
      });
    }

    // =====================================================
    // 5️⃣ Validasi Akun Peminjam
    // =====================================================
    const [memberRows] = await connection.query(
      'SELECT * FROM member WHERE member_id = ?',
      [borrower_nim.trim()]
    );

    if (memberRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'NIM peminjam tidak ditemukan di sistem.'
      });
    }

    const member = memberRows[0];

    // Validasi password (bcrypt atau plaintext)
    let isPasswordCorrect = false;
    if (
      typeof member.mpasswd === 'string' &&
      (member.mpasswd.startsWith('$2a$') ||
        member.mpasswd.startsWith('$2b$') ||
        member.mpasswd.startsWith('$2y$'))
    ) {
      isPasswordCorrect = await bcrypt.compare(borrower_password, member.mpasswd);
    } else {
      isPasswordCorrect = borrower_password === member.mpasswd;
    }

    if (!isPasswordCorrect) {
      await connection.rollback();
      return res.status(401).json({
        success: false,
        message: 'Password yang Anda masukkan tidak sesuai.'
      });
    }

    // Cek keanggotaan expired (opsional, sesuai kebutuhan)
    const today = dayjs().format('YYYY-MM-DD');
    if (member.expire_date && dayjs(member.expire_date).isBefore(today)) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: 'Keanggotaan peminjam telah kedaluwarsa. Silakan hubungi pustakawan.'
      });
    }

    // =====================================================
    // 6️⃣ Hitung Due Date (+7 hari, skip Minggu)
    // =====================================================
    let dueDate = dayjs();
    let daysAdded = 0;

    while (daysAdded < 7) {
      dueDate = dueDate.add(1, 'day');
      // Skip Minggu (day 0)
      if (dueDate.day() !== 0) {
        daysAdded++;
      }
    }

    // Jika hasil akhir jatuh di Minggu, geser ke Senin
    if (dueDate.day() === 0) {
      dueDate = dueDate.add(1, 'day');
    }

    const loanDate = dayjs().format('YYYY-MM-DD');
    const dueDateFormatted = dueDate.format('YYYY-MM-DD');

    // =====================================================
    // 7️⃣ Insert ke Tabel Loan
    // =====================================================
    await connection.query(`
      INSERT INTO loan (
        member_id, item_code, loan_date, due_date, renewed, loan_rules_id,
        is_lent, is_return, input_date, last_update, uid
      )
      VALUES (?, ?, ?, ?, 0, 0, 1, 0, NOW(), NOW(), ?)
    `, [
      member.member_id,
      item_code.trim(),
      loanDate,
      dueDateFormatted,
      req.session.user.id
    ]);

    // =====================================================
    // 8️⃣ Update Status Item menjadi 'PT'
    // =====================================================
    await connection.query(`
      UPDATE item
      SET item_status_id = 'PT',
          last_update = NOW(),
          uid = ?
      WHERE item_code = ?
    `, [req.session.user.id, item_code.trim()]);

    // Commit transaction
    await connection.commit();

    // =====================================================
    // 9️⃣ Cek Cover Image
    // =====================================================
    let coverImage = '/images/buku.png';
    if (book.image) {
      const imagePath = path.join(__dirname, '../../public', book.image);
      if (fs.existsSync(imagePath)) {
        coverImage = `/${book.image}`;
      }
    }

    // =====================================================
    // ✅ Return Success Response
    // =====================================================
    return res.status(200).json({
      success: true,
      message: 'Peminjaman berhasil dilakukan.',
      receipt: {
        member_name: member.member_name,
        member_id: member.member_id,
        book_title: book.title || 'Judul tidak tersedia',
        author: book.sor || 'Penulis tidak diketahui',
        loan_date: loanDate,
        due_date: dueDateFormatted,
        cover: coverImage,
        librarian_name: req.session.user.realname || req.session.user.id
      }
    });

  } catch (err) {
    await connection.rollback();
    console.error('❌ Error saat proses peminjaman:', err);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server. Silakan coba lagi.'
    });
  } finally {
    connection.release();
  }
};