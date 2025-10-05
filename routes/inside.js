const express = require('express');
const router = express.Router();
const peminjamanController = require('../controllers/inside/peminjamanController');

// =====================================================
// ROUTES UNTUK PUSTAKAWAN
// =====================================================
router.get('/peminjaman', peminjamanController.renderPeminjaman);
router.post('/peminjaman/find', peminjamanController.findBook);
router.post('/peminjaman/borrow', peminjamanController.borrowBook);

module.exports = router;
