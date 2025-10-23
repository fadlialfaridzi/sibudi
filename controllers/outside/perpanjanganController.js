const db = require('../../config/db');
const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');

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
    // 1️⃣ Daftar Buku Aktif Dipinjam
    // =============================
    const [loanRows] = await db.query(
      `SELECT 
        loan.loan_id,
        biblio.biblio_id,
        biblio.title,
        biblio.sor AS author,
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
    // 2️⃣ PARSING COLLATION FIELD & IMAGE FALLBACK
    // =============================
    const loans = loanRows.map((b) => {
      let edition = null;
      let pages = null;
      let size = null;

      // Parse collation
      if (b.collation) {
        const collation = b.collation.trim();

        // 1. Deteksi Edisi (angka romawi di awal atau Ed./Cet.)
        const editionMatch = collation.match(/^([ivxlcdm]+)\s*,?/i) || 
                            collation.match(/(?:ed\.?|cet\.?)\s*(\d+)/i);
        if (editionMatch) {
          edition = editionMatch[1].toUpperCase();
        }

        // 2. Deteksi Jumlah Halaman (hal. atau hlm.)
        const pagesMatch = collation.match(/(\d+)\s*(?:hal\.?|hlm\.?)/i);
        if (pagesMatch) {
          pages = `${pagesMatch[1]} Halaman`;
        }

        // 3. Deteksi Ukuran (cm)
        const sizeMatch = collation.match(/(\d+)\s*cm/i);
        if (sizeMatch) {
          size = `${sizeMatch[1]} cm`;
        }
      }

      // Image fallback logic
      let finalImage = '/images/buku.png';
      if (b.image) {
        // Cek apakah file ada di server
        const imagePath = path.join(__dirname, '../../public', b.image);
        if (fs.existsSync(imagePath)) {
          finalImage = b.image;
        }
      }

      return {
        ...b,
        edition,
        pages,
        size,
        image: finalImage,
      };
    });

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
      loans,
      totalDenda,
      popup: null,
      activeNav: 'Perpanjangan',
    });
  } catch (err) {
    console.error(' Gagal memuat dashboard perpanjangan:', err);
    res.render('outside/perpanjangan', {
      title: 'Detail & Perpanjangan Peminjaman',
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

    if (!loan_id) {
      return res.status(400).json({
        success: false,
        type: 'error',
        message: 'ID pinjaman tidak valid.',
      });
    }

    // Validasi ID Pinjaman
    const [loanRows] = await db.query(
      `SELECT loan_id, loan_date, due_date, renewed 
       FROM loan WHERE loan_id = ? AND member_id = ? AND is_return = 0`,
      [loan_id, memberId]
    );
    if (loanRows.length === 0) {
      return res.status(404).json({
        success: false,
        type: 'error',
        message: 'Data pinjaman tidak ditemukan.',
      });
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

    //  Hitung due_date baru +7 hari (skip hari Minggu)
    let newDue = dayjs(loan.due_date);
    let daysAdded = 0;
    while (daysAdded < 7) {
      newDue = newDue.add(1, 'day');
      // Jika bukan hari Minggu (0 = Minggu)
      if (newDue.day() !== 0) daysAdded++;
    }
    const newDueDate = newDue.format('YYYY-MM-DD');

    // Proses perpanjangan
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