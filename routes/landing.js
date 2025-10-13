const express = require('express');
const router = express.Router();

// Landing page utama
router.get('/', (req, res) => {
  res.render('landing/home', { title: 'SIBUDI - Sistem Informasi Buku Digital' });
});

// Halaman About
router.get('/about', (req, res) => {
  res.render('landing/about', {title: 'About - SIBUDI' });
});

// Halaman Panduan
router.get('/panduan', (req, res) => {
  res.render('landing/panduan', { title: 'Panduan Pengguna' });
});

// Halaman Login
router.get('/login', (req, res) => {
  res.render('login', { title: 'Login - SIBUDI' });
});

module.exports = router;
