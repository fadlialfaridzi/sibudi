// =====================================================
// 1. Import Modules
// =====================================================
require('dotenv').config(); // Load variabel dari .env

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

// =====================================================
// 2. Import Custom Modules & Routes
// =====================================================
const db = require('./config/db'); // koneksi database

// Routes utama
const indexRouter = require('./routes/index');   // sementara untuk testing
const usersRouter = require('./routes/users');

// Routes sistem
const landingRouter = require('./routes/landing'); // halaman publik
const insideRouter = require('./routes/inside');   // admin/pustakawan (dalam pustaka)
const outsideRouter = require('./routes/outside'); // peminjam (luar pustaka)

// =====================================================
// 3. Inisialisasi Aplikasi
// =====================================================
const app = express();

// =====================================================
// 4. Setup View Engine (EJS)
// =====================================================
// tambahkan beberapa path supaya include('partials/...') bisa dibaca dari mana pun
app.set('views', [
  path.join(__dirname, 'views'),
  path.join(__dirname, 'views/partials'),
  path.join(__dirname, 'views/landing'),
  path.join(__dirname, 'views/inside'),
  path.join(__dirname, 'views/outside'),
]);
app.set('view engine', 'ejs');

// =====================================================
// 5. Middleware Umum
// =====================================================
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Serving file statis (CSS, JS, gambar)
app.use(express.static(path.join(__dirname, 'public')));

// =====================================================
// 6. Routing
// =====================================================

// Landing page publik (home, about, panduan, login)
app.use('/', landingRouter);

// Route lama (index.ejs) — tetap aktif untuk perbandingan
app.use('/legacy', indexRouter);

// Route user umum (testing atau manajemen user)
app.use('/users', usersRouter);

// Role: pustakawan (akses komputer perpustakaan)
app.use('/inside', insideRouter);

// Role: anggota/peminjam (akses luar pustaka)
app.use('/outside', outsideRouter);

// =====================================================
// 7. Error Handling
// =====================================================

// Catch 404 dan teruskan ke handler error
app.use((req, res, next) => {
  next(createError(404));
});

// Error handler
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

// =====================================================
// 8. Export App
// =====================================================
module.exports = app;
