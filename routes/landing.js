const express = require('express');
const router = express.Router();

// Landing page utama
router.get('/', (req, res) => {
  res.render('home', { 
    title: 'SIBUDI - Sistem Informasi Peminjaman Buku Mandiri',
    activeNav: 'Home',
    user: req.session.user || null
  });
});

// Halaman About
router.get('/about', (req, res) => {
  res.render('landing/about', {
    title: 'About - SIBUDI',
    activeNav: 'About',
    user: req.session.user || null
  });
});

// Halaman Panduan
router.get('/panduan', (req, res) => {
  res.render('landing/panduan', { 
    title: 'Panduan Pengguna',
    activeNav: 'Panduan',
    user: req.session.user || null
  });
});

module.exports = router;
