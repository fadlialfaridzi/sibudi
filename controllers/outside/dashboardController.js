// =====================================================
// dashboardController.js
// Controller untuk halaman dashboard member (outside)
// =====================================================

const db = require('../../config/db'); // mysql2/promise pool

/**
 * Render halaman dashboard member
 * Menampilkan statistik: total buku dipinjam & total denda
 */
exports.renderDashboard = async (req, res) => {
  try {
    // Ambil data user dari session
    const user = req.session.user;
    
    // Validasi session
    if (!user || user.role !== 'member') {
      return res.redirect('/login');
    }

    const memberId = user.id;

    // =====================================================
    // Query 1: Total Buku yang Sedang Dipinjam (Aktif)
    // =====================================================
    const [loansResult] = await db.query(
      `SELECT COUNT(*) as total 
       FROM loan 
       WHERE member_id = ? 
       AND is_return = 0`,
      [memberId]
    );
    const totalLoans = loansResult[0]?.total || 0;

    // =====================================================
    // Query 2: Total Denda yang Belum Dibayar
    // Menggunakan rumus: SUM(debet) - SUM(credit) 
    // =====================================================
    const [finesResult] = await db.query(
      `SELECT 
         IFNULL(SUM(debet), 0) - IFNULL(SUM(credit), 0) AS total_due
       FROM fines 
       WHERE member_id = ?`,
      [memberId]
    );
    const totalFines = finesResult[0]?.total_due || 0;

    // =====================================================
    // Render View dengan Data
    // =====================================================
    res.render('outside/dashboard', {
      title: 'Dashboard - SIBUDI',
      user,
      totalLoans,
      totalFines,
      popup: req.session.popup || null
    });

    // Clear popup setelah ditampilkan
    delete req.session.popup;

  } catch (error) {
    console.error('❌ Error di dashboardController:', error);
    
    // Fallback jika terjadi error
    res.render('outside/dashboard', {
      title: 'Dashboard - SIBUDI',
      user: req.session.user || {},
      totalLoans: 0,
      totalFines: 0,
      popup: {
        type: 'error',
        title: 'Terjadi Kesalahan',
        message: 'Gagal memuat data dashboard. Silakan refresh halaman.'
      }
    });
  }
};