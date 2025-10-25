// routes/inside.js
const express = require('express');
const router = express.Router();
const peminjamanController = require('../controllers/inside/peminjamanController');

// =====================================================
// 🏛️ ROUTES MODE KIOS (PUSTAKAWAN)
// =====================================================

// 🟢 Halaman utama kios peminjaman
router.get('/peminjaman', peminjamanController.renderPeminjaman);

// 🟢 Cari buku berdasarkan item_code (via form / scan)
router.post('/peminjaman/find', peminjamanController.findBook);

// 🟢 API untuk proses transaksi peminjaman
router.post('/api/kiosk/borrow', peminjamanController.borrowBookAPI);

// 🟢 Halaman struk peminjaman 
router.get('/strukPinjam', peminjamanController.renderStrukPinjam);

// =====================================================
// 📦 (Opsional - nanti) API pengembalian buku
// =====================================================
// router.post('/api/kiosk/return', pengembalianController.returnBookAPI);

// =====================================================
// ✅ Export router
// =====================================================
module.exports = router;
