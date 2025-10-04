const express = require('express');
const router = express.Router();

// Import controller untuk halaman luar (peminjam)
const detailPinjamController = require('../controllers/outside/detailPinjamController');
const perpanjanganController = require('../controllers/outside/perpanjanganController');
const dendaController = require('../controllers/outside/dendaController');

// =====================================================
// ROUTES untuk ROLE: Member / Peminjam (Outside)
// =====================================================

// Detail buku yang sedang dipinjam
router.get('/detailPinjam', detailPinjamController.renderDetailPinjam);

// Perpanjangan buku
router.get('/perpanjangan', perpanjanganController.renderPerpanjangan);

// Denda
router.get('/denda', dendaController.renderDenda);

// Halaman about (publik, tapi untuk member area)
router.get('/about', (req, res) => {
  res.render('outside/about', { title: 'Tentang SiBuDi (Member)' });
});

module.exports = router;
