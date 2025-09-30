// =====================================================
// 1. Import Modules
// =====================================================
var createError = require('http-errors'); // untuk handle error HTTP (404, 500, dll)
var express = require('express');         // framework utama
var path = require('path');               // manipulasi path
var cookieParser = require('cookie-parser'); // parsing cookie
var logger = require('morgan');           // logger request (GET/POST dll)

// Import routes
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

// =====================================================
// 2. Inisialisasi Aplikasi
// =====================================================
var app = express();

// =====================================================
// 3. Setup View Engine (EJS)
// =====================================================
app.set('views', path.join(__dirname, 'views')); // folder views
app.set('view engine', 'ejs'); // pakai ejs

// =====================================================
// 4. Middleware Umum
// =====================================================
app.use(logger('dev')); // log request ke console
app.use(express.json()); // parsing JSON body
app.use(express.urlencoded({ extended: false })); // parsing form-urlencoded
app.use(cookieParser()); // parsing cookies

// serving static files (css, js, image dari folder public)
app.use(express.static(path.join(__dirname, 'public')));

// =====================================================
// 5. Routing
// =====================================================
app.use('/', indexRouter);   // route default "/"
app.use('/users', usersRouter); // route "/users"

// =====================================================
// 6. Error Handling
// =====================================================

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, hanya tampil detail error kalau env = development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render halaman error (views/error.ejs)
  res.status(err.status || 500);
  res.render('error');
});

// =====================================================
// 7. Export App
// =====================================================
module.exports = app;
