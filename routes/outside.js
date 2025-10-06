const express = require('express');
const router = express.Router();

// Import controller untuk halaman luar (peminjam)
const perpanjanganController = require('../controllers/outside/perpanjanganController');
const dendaController = require('../controllers/outside/dendaController');

// Middleware (opsional, jika sudah ada di project-mu)
const { requireLogin, requireRole } = require('../middleware/sessionCheck');

// =====================================================
// ROUTES untuk ROLE: Member / Peminjam (Outside)
// =====================================================

// Halaman Dasbor Peminjaman & Perpanjangan
router.get('/perpanjangan', requireLogin, requireRole('member'), perpanjanganController.renderPerpanjangan);

// Endpoint AJAX untuk proses perpanjangan
router.post('/extend', requireLogin, requireRole('member'), perpanjanganController.extendLoan);

// Halaman Denda
router.get('/denda', requireLogin, requireRole('member'), dendaController.renderDenda);

// Halaman About (opsional, masih bagian area member)
router.get('/about', (req, res) => {
    res.render('outside/about', { title: 'Tentang SiBuDi (Member)' });
});

module.exports = router;
