const db = require('../../config/db');

// =====================================================
// DETAIL PINJAMAN (MEMBER)
// =====================================================
exports.renderDetailPinjam = async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'member') {
      return res.redirect('/login');
    }

    const memberId = req.session.user.id;

    // Ambil data member untuk kartu profil
    const [memberRows] = await db.query(
      'SELECT member_id, member_name, member_email FROM member WHERE member_id = ?',
      [memberId]
    );

    // Ambil daftar buku yang sedang dipinjam
    const [loanRows] = await db.query(
      `SELECT 
        loan.loan_id,
        biblio.biblio_id,
        biblio.title,
        biblio.notes,
        biblio.author,
        biblio.publisher,
        loan.loan_date,
        loan.due_date
      FROM loan
      JOIN item ON loan.item_code = item.item_code
      JOIN biblio ON item.biblio_id = biblio.biblio_id
      WHERE loan.member_id = ? AND loan.is_return = 0
      ORDER BY loan.loan_date DESC`,
      [memberId]
    );

    res.render('outside/detailPinjam', {
      title: 'Detail Peminjaman',
      member: memberRows[0],
      loans: loanRows,
      popup: null,
    });
  } catch (err) {
    console.error('❌ Gagal memuat detail pinjam:', err);
    res.render('outside/detailPinjam', {
      title: 'Detail Peminjaman',
      member: null,
      loans: [],
      popup: {
        type: 'error',
        title: 'Kesalahan Server',
        message: 'Terjadi kesalahan saat memuat data peminjaman.',
      },
    });
  }
};
