const db = require('../../config/db');
const dayjs = require('dayjs');

// =====================================================
// DASHBOARD PEMINJAMAN & PERPANJANGAN
// =====================================================
exports.renderPerpanjangan = async (req, res) => {
  try {
    // Pastikan user login & role = member
    if (!req.session.user || req.session.user.role !== 'member') {
      return res.redirect('/login');
    }

    const memberId = req.session.user.id;

    // =============================
    // 1️⃣ Data Profil Member
    // =============================
    const [memberRows] = await db.query(
      'SELECT member_id, member_name, member_email FROM member WHERE member_id = ?',
      [memberId]
    );
    const member = memberRows[0] || null;

    // =============================
    // 2️⃣ Daftar Buku Aktif Dipinjam
    // =============================
    const [loanRows] = await db.query(
      `SELECT 
        loan.loan_id,
        biblio.biblio_id,
        biblio.title,
        biblio.sor AS author,       -- gunakan kolom sor (penulis/penerbit)
        biblio.notes,
        biblio.image,
        biblio.publish_year,
        biblio.collation,
        biblio.language_id,
        loan.loan_date,
        loan.due_date,
        loan.renewed
      FROM loan
      JOIN item ON loan.item_code = item.item_code
      JOIN biblio ON item.biblio_id = biblio.biblio_id
      WHERE loan.member_id = ? AND loan.is_return = 0
      ORDER BY loan.loan_date DESC`,
      [memberId]
    );

    // =============================
    // 3️⃣ Total Denda Aktif (belum lunas)
    // =============================
    const [fineRows] = await db.query(
      `SELECT 
         IFNULL(SUM(fines.debet),0) - IFNULL(SUM(fines.credit),0) AS total_due
       FROM fines
       WHERE fines.member_id = ?`,
      [memberId]
    );
    const totalDenda = fineRows[0]?.total_due || 0;

    res.render('outside/perpanjangan', {
      title: 'Detail & Perpanjangan Peminjaman',
      member,
      loans: loanRows,
      totalDenda,
      popup: null,
      activeNav: 'Perpanjangan',
    });
  } catch (err) {
    console.error('❌ Gagal memuat dashboard perpanjangan:', err);
    res.render('outside/perpanjangan', {
      title: 'Detail & Perpanjangan Peminjaman',
      member: null,
      loans: [],
      totalDenda: 0,
      popup: {
        type: 'error',
        title: 'Kesalahan Server',
        message: 'Terjadi kesalahan saat memuat data peminjaman.',
      },
      activeNav: 'Perpanjangan',
    });
  }
};

// =====================================================
// FUNGSI: PROSES PERPANJANGAN (AJAX POST /outside/extend)
// =====================================================
exports.extendLoan = async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'member') {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { loan_id } = req.body;
    const memberId = req.session.user.id;

    // Validasi ID Pinjaman
    const [loanRows] = await db.query(
      `SELECT loan_id, loan_date, due_date, renewed 
       FROM loan WHERE loan_id = ? AND member_id = ? AND is_return = 0`,
      [loan_id, memberId]
    );
    if (loanRows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Data pinjaman tidak ditemukan.' });
    }

    const loan = loanRows[0];

    // Validasi Denda Aktif
    const [fineRows] = await db.query(
      `SELECT IFNULL(SUM(fines.debet),0) - IFNULL(SUM(fines.credit),0) AS total_due 
       FROM fines WHERE member_id = ?`,
      [memberId]
    );
    const totalDenda = fineRows[0].total_due || 0;
    if (totalDenda > 0) {
      return res.status(400).json({
        success: false,
        type: 'warning',
        message:
          'Tidak dapat memperpanjang, Anda masih memiliki denda yang belum lunas.',
      });
    }

    // Validasi Batas Perpanjangan
    if (loan.renewed >= 2) {
      return res.status(400).json({
        success: false,
        type: 'warning',
        message: 'Anda sudah mencapai batas maksimal perpanjangan (2x).',
      });
    }

    // Proses perpanjangan (tambah 7 hari dari due_date)
    const newDueDate = dayjs(loan.due_date)
      .add(7, 'day')
      .format('YYYY-MM-DD');

    await db.query(
      `UPDATE loan 
       SET due_date = ?, renewed = renewed + 1 
       WHERE loan_id = ?`,
      [newDueDate, loan_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Perpanjangan berhasil dilakukan!',
      receipt: {
        memberId,
        loanId: loan.loan_id,
        oldDueDate: loan.due_date,
        newDueDate,
        renewed: loan.renewed + 1,
      },
    });
  } catch (err) {
    console.error('❌ Gagal memperpanjang pinjaman:', err);
    return res.status(500).json({
      success: false,
      type: 'error',
      message: 'Terjadi kesalahan saat memproses perpanjangan.',
    });
  }
};
