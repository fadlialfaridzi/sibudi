const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const forgetController = require('../controllers/forgetController');

// Halaman login
router.get('/login', authController.showLogin);

// Proses login
router.post('/login', authController.login);

// Logout (untuk member - langsung logout)
router.get('/logout', authController.logout);

// Logout dengan validasi password (untuk pustakawan)
router.post('/logout-validate', authController.validateLogout);

// =====================================================
// Lupa Password Routes
// =====================================================

// Halaman lupa password
router.get('/lupa-password', forgetController.showForgetPassword);

// Kirim email reset password
router.post('/lupa-password', forgetController.sendResetEmail);

// Halaman reset password dengan token
router.get('/reset-password/:token', forgetController.showResetPassword);

// Proses reset password
router.post('/reset-password/:token', forgetController.resetPassword);

module.exports = router;