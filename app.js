// =====================================================
// app.js - Konfigurasi Utama Aplikasi SiBuDi (Final)
// =====================================================

// 1️⃣ IMPORT MODULES & ENVIRONMENT
require('dotenv').config();
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

// 2️⃣ IMPORT CUSTOM MODULES & ROUTES
const db = require('./config/db'); // koneksi database
const security = require('./middleware/security'); // helmet + CSP + limiter

// routes utama
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

// routes sistem inti
const authRouter = require('./routes/auth');       // login/logout
const landingRouter = require('./routes/landing'); // halaman publik
const insideRouter = require('./routes/inside');   // pustakawan
const outsideRouter = require('./routes/outside'); // peminjam

// 3️⃣ INISIALISASI APP EXPRESS
const app = express();

// =====================================================
// 4️⃣ MIDDLEWARE KEAMANAN (Helmet, CSP, Rate Limiter)
// =====================================================
security(app); // aktifkan modul keamanan

// =====================================================
// 5️⃣ KONFIGURASI VIEW ENGINE (EJS)
// =====================================================
app.set('views', [
  path.join(__dirname, 'views'),
  path.join(__dirname, 'views/partials'),
  path.join(__dirname, 'views/auth'),
  path.join(__dirname, 'views/landing'),
  path.join(__dirname, 'views/inside'),
  path.join(__dirname, 'views/outside'),
]);
app.set('view engine', 'ejs');

// =====================================================
// 6️⃣ MIDDLEWARE SESSION (MySQL Session Store)
// =====================================================
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  clearExpired: true,
  checkExpirationInterval: 900000, // 15 menit
  expiration: 1000 * 60 * 60 * 8, // 8 jam
});

app.use(
  session({
    key: 'sibudi_session_id',
    secret: process.env.SESSION_SECRET || 'sibudi_secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8, // 8 jam
      httpOnly: true,
      secure: false, // ganti true kalau sudah pakai HTTPS
    },
  })
);

// =====================================================
// 7️⃣ MIDDLEWARE UMUM
// =====================================================
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// =====================================================
// 8️⃣ SET GLOBAL VARIABLE UNTUK VIEW
// =====================================================
// (memudahkan akses info user di semua halaman ejs)
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// =====================================================
// 9️⃣ ROUTING
// =====================================================

// Autentikasi (login & logout)
app.use('/', authRouter);

// Halaman publik (Home, About, Panduan)
app.use('/', landingRouter);

// Rute testing (legacy)
app.use('/legacy', indexRouter);

// Rute user management (admin/testing)
app.use('/users', usersRouter);

// Rute pustakawan (Mode Kios / Inside)
app.use('/inside', insideRouter);

// Rute peminjam (Dashboard Member / Outside)
app.use('/outside', outsideRouter);

// =====================================================
// 🔟 ERROR HANDLING
// =====================================================

// Handle 404 - jika route tidak ditemukan
app.use((req, res, next) => {
  next(createError(404));
});

// Error handler umum
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

// =====================================================
// 🔚 EXPORT APP
// =====================================================
module.exports = app;
