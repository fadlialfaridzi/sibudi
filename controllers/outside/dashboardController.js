// =====================================================
// dashboardController.js
// Controller untuk halaman dashboard member (outside)
// =====================================================

const db = require('../../config/db'); // mysql2/promise pool
const { createLogger } = require('../../utils/logger');

// Inisialisasi logger khusus untuk dashboard
const logger = createLogger('dashboard.log');


/**
 * Render halaman dashboard member
 * Menampilkan statistik: total buku dipinjam & total denda
 */
exports.renderDashboard = async (req, res) => {
  const memberId = req.session.user ? req.session.user.id : 'Guest';
  const ip = req.ip;
  logger(`START: renderDashboard for memberId: ${memberId} from IP: ${ip}`, 'INFO');

  try {
    // Ambil data user dari session
    const user = req.session.user;
    
    // Validasi session
    if (!user || user.role !== 'member') {
      logger(`Unauthorized access attempt to dashboard from IP: ${ip}`, 'WARN');
      return res.redirect('/login');
    }

    logger(`Fetching dashboard data for memberId: ${memberId}`, 'INFO');

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
    logger(`Active loans count for memberId ${memberId}: ${totalLoans}`, 'INFO');

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
    logger(`Total outstanding fines for memberId ${memberId}: Rp ${totalFines}`, 'INFO');

    // =====================================================
    // Render View dengan Data
    // =====================================================
    logger(`Rendering dashboard for memberId: ${memberId}`, 'INFO');
    res.render('outside/dashboard', {
      title: 'Dashboard - SIBUDI',
      user,
      totalLoans,
      totalFines,
      popup: req.session.popup || null,
      activeNav: 'Dashboard'
    });

    // Clear popup setelah ditampilkan
    delete req.session.popup;
    logger(`Successfully rendered dashboard for memberId: ${memberId}`, 'INFO');

  } catch (error) {
    logger(`Server error in renderDashboard for memberId: ${memberId}. Error: ${error.message}`, 'ERROR');
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
      },
      activeNav: 'Dashboard'
    });
  }
};