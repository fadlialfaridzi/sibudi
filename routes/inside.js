const express = require('express');
const router = express.Router();

// Import controller untuk halaman dalam (pustakawan/admin)
const peminjamanController = require('../controllers/inside/peminjamanController');

// =====================================================
// ROUTES untuk ROLE: Admin / Petugas Pustaka (Inside)
// =====================================================

// Halaman utama pustaka (peminjaman buku di komputer pustaka)
router.get('/peminjaman', peminjamanController.renderPeminjaman);

// Halaman About di dalam pustaka (optional)
router.get('/about', (req, res) => {
  res.render('inside/about', { title: 'Tentang SiBuDi (Pustaka)' });
});

module.exports = router;
