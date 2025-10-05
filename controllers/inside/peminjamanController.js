const db = require('../../config/db');
const bcrypt = require('bcrypt');
const dayjs = require('dayjs');

// =====================================================
// RENDER HALAMAN PEMINJAMAN (Pustakawan)
// =====================================================
exports.renderPeminjaman = (req, res) => {
  if (!req.session.user || req.session.user.role !== 'pustakawan') {
    return res.redirect('/login');
  }

  res.render('inside/peminjaman', { title: 'Peminjaman Buku', popup: null, book: null });
};

// =====================================================
// POST: Cari Buku Berdasarkan item_code
// =====================================================
exports.findBook = async (req, res) => {
  const { item_code } = req.body;

  try {
    const [rows] = await db.query(
      `SELECT item.item_code, biblio.title, biblio.author, biblio.publisher
       FROM item
       JOIN biblio ON item.biblio_id = biblio.biblio_id
       WHERE item.item_code = ?`,
      [item_code]
    );

    if (rows.length === 0) {
      return res.render('inside/peminjaman', {
        title: 'Peminjaman Buku',
        popup: {
          type: 'error',
          title: 'Kode Tidak Ditemukan',
          message: 'Kode buku salah atau tidak terdaftar.',
        },
        book: null,
      });
    }

    res.render('inside/peminjaman', { title: 'Peminjaman Buku', book: rows[0], popup: null });
  } catch (err) {
    console.error('❌ Gagal mencari buku:', err);
    res.render('inside/peminjaman', {
      title: 'Peminjaman Buku',
      popup: {
        type: 'error',
        title: 'Kesalahan Server',
        message: 'Terjadi kesalahan saat mencari buku.',
      },
      book: null,
    });
  }
};

// =====================================================
// POST: Proses Peminjaman Buku
// =====================================================
exports.borrowBook = async (req, res) => {
  const { item_code, nim, password } = req.body;

  try {
    // Cek member
    const [members] = await db.query('SELECT * FROM member WHERE member_id = ?', [nim]);
    if (members.length === 0) {
      return res.render('inside/peminjaman', {
        popup: { type: 'error', title: 'Gagal', message: 'Akun tidak ditemukan.' },
        book: null,
      });
    }

    const member = members[0];
    const validPass = await bcrypt.compare(password, member.mpasswd);
    if (!validPass) {
      return res.render('inside/peminjaman', {
        popup: { type: 'error', title: 'Login Gagal', message: 'Password tidak sesuai.' },
        book: null,
      });
    }

    // Cek ketersediaan item
    const [checkItem] = await db.query('SELECT * FROM loan WHERE item_code = ? AND is_return = 0', [item_code]);
    if (checkItem.length > 0) {
      return res.render('inside/peminjaman', {
        popup: { type: 'warning', title: 'Buku Sedang Dipinjam', message: 'Buku ini belum dikembalikan.' },
        book: null,
      });
    }

    // Insert loan baru
    const today = dayjs();
    const due = today.add(7, 'day'); // masa pinjam 7 hari
    await db.query(
      `INSERT INTO loan (member_id, item_code, loan_date, due_date, is_return)
       VALUES (?, ?, ?, ?, 0)`,
      [nim, item_code, today.format('YYYY-MM-DD'), due.format('YYYY-MM-DD')]
    );

    res.render('inside/peminjaman', {
      popup: { type: 'success', title: 'Berhasil', message: 'Peminjaman berhasil dilakukan.' },
      book: null,
    });
  } catch (err) {
    console.error('❌ Gagal meminjam buku:', err);
    res.render('inside/peminjaman', {
      popup: { type: 'error', title: 'Kesalahan Server', message: 'Terjadi kesalahan pada server.' },
      book: null,
    });
  }
};
