// controllers/inside/peminjamanController.js
const db = require('../../config/db');
const bcrypt = require('bcrypt');
const dayjs = require('dayjs');

// =====================================================
// 🔧 Helper: Hitung due_date +7 hari tanpa hari Minggu
// =====================================================
function addDaysExcludeSunday(startDate, daysToAdd) {
  let date = dayjs(startDate);
  let added = 0;
  while (added < daysToAdd) {
    date = date.add(1, 'day');
    if (date.day() !== 0) added++; // skip Sunday (0 = Sunday)
  }
  return date;
}

// =====================================================
// 🟢 Render Halaman Peminjaman Kios
// =====================================================
exports.renderPeminjaman = (req, res) => {
  if (!req.session.user || req.session.user.role !== 'pustakawan') {
    return res.redirect('/login');
  }

  res.render('inside/peminjaman', {
    title: 'Kios Peminjaman Buku',
    popup: null,
    book: null,
    activeNav: 'Peminjaman',
  });
};

// =====================================================
// 🟢 POST /inside/peminjaman/find — Cari Buku via item_code
// =====================================================
exports.findBook = async (req, res) => {
  const { item_code } = req.body;

  try {
    const [rows] = await db.query(
      `SELECT 
         item.item_code,
         item.item_status_id,
         biblio.title,
         biblio.sor AS author,
         biblio.notes,
         biblio.publish_year
       FROM item
       JOIN biblio ON item.biblio_id = biblio.biblio_id
       WHERE item.item_code = ?`,
      [item_code]
    );

    if (rows.length === 0) {
      return res.render('inside/peminjaman', {
        title: 'Kios Peminjaman Buku',
        popup: {
          type: 'error',
          title: 'Kode Tidak Ditemukan',
          message: 'Kode buku salah atau tidak terdaftar.',
        },
        book: null,
        activeNav: 'Peminjaman',
      });
    }

    // Tidak perlu validasi status item_status_id di mode kios
    res.render('inside/peminjaman', {
      title: 'Kios Peminjaman Buku',
      book: rows[0],
      popup: null,
      activeNav: 'Peminjaman',
    });
  } catch (err) {
    console.error('❌ Gagal mencari buku:', err);
    res.render('inside/peminjaman', {
      title: 'Kios Peminjaman Buku',
      popup: {
        type: 'error',
        title: 'Kesalahan Server',
        message: 'Terjadi kesalahan saat mencari buku.',
      },
      book: null,
      activeNav: 'Peminjaman',
    });
  }
};

// =====================================================
// 🟢 API POST /api/kiosk/borrow — Transaksi Mode Kios
// =====================================================
exports.borrowBookAPI = async (req, res) => {
  try {
    // Pastikan pustakawan login
    if (!req.session.user || req.session.user.role !== 'pustakawan') {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { item_code, borrower_nim, borrower_password } = req.body;
    if (!item_code || !borrower_nim || !borrower_password) {
      return res.status(400).json({ message: 'Data tidak lengkap.' });
    }

    // 1️⃣ Validasi item (tanpa cek status_id)
    const [itemRows] = await db.query(
      'SELECT item_code, biblio_id FROM item WHERE item_code = ?',
      [item_code]
    );
    if (itemRows.length === 0) {
      return res.status(404).json({ message: 'Kode buku tidak ditemukan.' });
    }
    const item = itemRows[0];

    // 2️⃣ Validasi member
    const [memberRows] = await db.query(
      'SELECT member_id, mpasswd, member_name FROM member WHERE member_id = ?',
      [borrower_nim]
    );
    if (memberRows.length === 0) {
      return res.status(404).json({ message: 'Akun peminjam tidak ditemukan.' });
    }
    const member = memberRows[0];

    // Validasi password (bcrypt / plaintext)
    let isMatch = false;
    if (
      typeof member.mpasswd === 'string' &&
      (member.mpasswd.startsWith('$2a$') ||
        member.mpasswd.startsWith('$2b$') ||
        member.mpasswd.startsWith('$2y$'))
    ) {
      isMatch = await bcrypt.compare(borrower_password, member.mpasswd);
    } else {
      isMatch = borrower_password === member.mpasswd;
    }

    if (!isMatch) {
      return res.status(400).json({ message: 'Password peminjam tidak sesuai.' });
    }

    // 3️⃣ Buat peminjaman
    const today = dayjs();
    const dueDate = addDaysExcludeSunday(today, 7);

    await db.query(
      `INSERT INTO loan (member_id, item_code, loan_date, due_date, is_return, renewed)
       VALUES (?, ?, ?, ?, 0, 0)`,
      [borrower_nim, item_code, today.format('YYYY-MM-DD'), dueDate.format('YYYY-MM-DD')]
    );

    // 4️⃣ Update status item → "PT" (dipinjam)
    await db.query('UPDATE item SET item_status_id = "PT" WHERE item_code = ?', [item_code]);

    // 5️⃣ Ambil detail buku untuk struk
    const [biblioRows] = await db.query(
      'SELECT title, sor AS author FROM biblio WHERE biblio_id = ?',
      [item.biblio_id]
    );

    const book = biblioRows[0] || { title: '-', author: '-' };

    // ✅ Sukses
    return res.status(200).json({
      success: true,
      message: 'Peminjaman berhasil dilakukan.',
      receipt: {
        member_id: borrower_nim,
        member_name: member.member_name,
        item_code,
        book_title: book.title,
        author: book.author,
        loan_date: today.format('YYYY-MM-DD'),
        due_date: dueDate.format('YYYY-MM-DD'),
      },
    });
  } catch (err) {
    console.error('❌ Gagal memproses peminjaman:', err);
    return res.status(500).json({
      message: 'Terjadi kesalahan pada server.',
    });
  }
};
