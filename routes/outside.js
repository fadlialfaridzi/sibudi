// routes/outside.js
const express = require('express');
const router = express.Router();

// Import controller untuk halaman luar (peminjam)
const dashboardController = require('../controllers/outside/dashboardController');
const profileController = require('../controllers/outside/profileController');
const perpanjanganController = require('../controllers/outside/perpanjanganController');
const dendaController = require('../controllers/outside/dendaController');
const changePasswordController = require('../controllers/outside/changePasswordController');

// Middleware
const { requireLogin, requireRole } = require('../middleware/sessionCheck');

// =====================================================
// ROUTES untuk ROLE: Member / Peminjam (Outside)
// =====================================================

// Halaman Dashboard (Landing page setelah login)
router.get('/dashboard', requireLogin, requireRole('member'), dashboardController.renderDashboard);

// Halaman Profile
router.get('/profile', requireLogin, requireRole('member'), profileController.renderProfile);
router.get('/editProfile', requireLogin, requireRole('member'), profileController.renderEditProfile);
router.post('/updateProfile', requireLogin, requireRole('member'), profileController.updateProfile);

// Halaman Ubah Password
router.get('/changePassword', requireLogin, requireRole('member'), changePasswordController.renderChangePassword);
router.post('/changePassword', requireLogin, requireRole('member'), changePasswordController.updatePassword);

// =====================================================
// 📚 HALAMAN DETAIL PEMINJAMAN & PERPANJANGAN
// =====================================================

// Render halaman detailPinjam dengan data perpanjangan DAN denda
router.get('/detailPinjam', requireLogin, requireRole('member'), perpanjanganController.renderPerpanjangan);

// Endpoint perpanjangan buku (POST)
router.post('/extend', requireLogin, requireRole('member'), perpanjanganController.extendLoan);

// =====================================================
// 💰 HALAMAN INFORMASI DENDA (Standalone)
// =====================================================

// Render halaman khusus denda (jika ada halaman terpisah)
router.get('/denda', requireLogin, requireRole('member'), dendaController.renderDenda);

// =====================================================
// 📄 HALAMAN ABOUT
// =====================================================
router.get('/about', (req, res) => {
    res.render('outside/about', { 
        title: 'Tentang SiBuDi (Member)',
        activeNav: 'About',
        user: req.session.user
    });
});

// =====================================================
// 📖 HALAMAN ATURAN PEMINJAMAN
// =====================================================
router.get('/rulesPinjam', requireLogin, requireRole('member'), async (req, res) => {
    try {
        const db = require('../config/db');
        
        // Ambil aturan peminjaman dari database
        const [rulesRows] = await db.query(
            `SELECT 
                mlr.loan_rules_id,
                mlr.loan_rules_name,
                mlr.fine_each_day,
                mlr.loan_periode,
                mlr.reborrow_limit,
                mct.coll_type_name,
                mmt.member_type_name
            FROM mst_loan_rules mlr
            LEFT JOIN mst_coll_type mct ON mlr.coll_type_id = mct.coll_type_id
            LEFT JOIN mst_member_type mmt ON mlr.member_type_id = mmt.member_type_id
            ORDER BY mlr.loan_rules_id ASC`
        );

        res.render('outside/rulesPinjam', {
            title: 'Aturan Peminjaman',
            rules: rulesRows,
            activeNav: 'RulesPinjam',
            user: req.session.user
        });
    } catch (err) {
        console.error('❌ Error renderRulesPinjam:', err);
        res.render('outside/rulesPinjam', {
            title: 'Aturan Peminjaman',
            rules: [],
            activeNav: 'RulesPinjam',
            user: req.session.user,
            error: 'Terjadi kesalahan saat memuat aturan peminjaman.'
        });
    }
});

module.exports = router;