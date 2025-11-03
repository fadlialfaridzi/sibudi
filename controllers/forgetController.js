// =====================================================
// controllers/forgetController.js
// Fitur Lupa Password dengan Email (Gmail/Outlook)
// =====================================================

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../config/db');
const { createLogger } = require('../utils/logger');

// Inisialisasi logger khusus untuk fitur lupa password
const logger = createLogger('forget-password.log');


// =====================================================
// Konfigurasi Email Transporter
// =====================================================
const createTransporter = () => {
    const emailService = process.env.EMAIL_SERVICE || 'gmail';
    logger(`Membuat transporter email untuk layanan: ${emailService}`, 'INFO');
    
    // Konfigurasi untuk Gmail
    if (emailService === 'gmail') {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }
    
    // Konfigurasi untuk Outlook/Hotmail/Microsoft 365
    if (emailService === 'outlook' || emailService === 'office365') {
        return nodemailer.createTransport({
            host: emailService === 'office365' ? 'smtp.office365.com' : 'smtp-mail.outlook.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            tls: {
                ciphers: 'SSLv3',
                rejectUnauthorized: false,
            },
        });
    }
    
    // Default ke Gmail jika service tidak dikenali
    logger(`Layanan email '${emailService}' tidak dikenali, kembali ke default gmail.`, 'WARN');
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
};

// =====================================================
// GET /lupa-password - Tampilkan form lupa password
// =====================================================
exports.showForgetPassword = (req, res) => {
    const ip = req.ip;
    logger(`MULAI: Halaman showForgetPassword dirender untuk IP: ${ip}`, 'INFO');
    res.render('auth/lupapassword', { popup: null });
};

// =====================================================
// POST /lupa-password - Kirim email reset password
// =====================================================
exports.sendResetEmail = async (req, res) => {
    const { email } = req.body;
    const ip = req.ip;
    logger(`MULAI: Upaya sendResetEmail untuk email: '${email}' dari IP: ${ip}`, 'INFO');

    try {
        // Validasi input
        if (!email) {
            logger(`sendResetEmail gagal: Bidang email kosong dari IP: ${ip}`, 'WARN');
            return res.status(400).render('auth/lupapassword', {
                popup: {
                    type: 'warning',
                    title: 'Email Diperlukan',
                    message: 'Mohon masukkan alamat email Anda.',
                },
            });
        }

        // Cek email di tabel user (pustakawan/admin)
        logger(`Mencari email '${email}' di tabel pengguna dan anggota.`, 'INFO');
        const [userRows] = await db.query('SELECT user_id, username, email FROM user WHERE email = ?', [email]);

        // Cek email di tabel member
        const [memberRows] = await db.query('SELECT member_id, member_name, member_email FROM member WHERE member_email = ?', [email]);

        if (userRows.length === 0 && memberRows.length === 0) {
            logger(`sendResetEmail gagal: Email '${email}' tidak ditemukan di database.`, 'WARN');
            return res.status(404).render('auth/lupapassword', {
                popup: {
                    type: 'error',
                    title: 'Email Tidak Ditemukan',
                    message: 'Email yang Anda masukkan tidak terdaftar di sistem.',
                },
            });
        }

        // Generate token unik
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 jam dari sekarang
        logger(`Token reset baru dibuat untuk email: '${email}'`, 'INFO');

        let userId = null;
        let memberId = null;
        let userType = '';
        let userName = '';

        if (userRows.length > 0) {
            userId = userRows[0].user_id;
            userName = userRows[0].username;
            userType = 'user';
            logger(`Email '${email}' ditemukan untuk ID pengguna (pustakawan/admin): ${userId}`, 'INFO');
        } else {
            memberId = memberRows[0].member_id;
            userName = memberRows[0].member_name;
            userType = 'member';
            logger(`Email '${email}' ditemukan untuk ID anggota: ${memberId}`, 'INFO');
        }

        // Simpan token ke database
        await db.query(
            `INSERT INTO password_reset_tokens (user_id, member_id, email, token, user_type, expires_at) 
             VALUES (?, ?, ?, ?, ?, ?)`, 
            [userId, memberId, email, resetToken, userType, expiresAt]
        );
        logger(`Token reset untuk '${email}' berhasil disimpan ke database.`, 'INFO');

        // Kirim email
        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
        
        const transporter = createTransporter();
        const mailOptions = {
            from: `"SIBUDI - Perpustakaan Unand" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Reset Password - SIBUDI',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #166534 0%, #15803d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                        .button { display: inline-block; padding: 14px 28px; background: #15803d; color: white; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
                        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
                        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; border-radius: 4px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1 style="margin: 0; font-size: 32px;">SIBUDI</h1>
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">Sistem Peminjaman dan Perpanjangan Buku Mandiri</p>
                        </div>
                        <div class="content">
                            <h2 style="color: #166534; margin-top: 0;">Reset Password</h2>
                            <p>Halo <strong>${userName}</strong>,</p>
                            <p>Kami menerima permintaan untuk mereset password akun Anda. Klik tombol di bawah ini untuk melanjutkan:</p>
                            <div style="text-align: center;">
                                <a href="${resetUrl}" class="button">RESET PASSWORD</a>
                            </div>
                            <p>Atau salin dan tempel link berikut di browser Anda:</p>
                            <p style="background: white; padding: 12px; border-radius: 6px; word-break: break-all; font-size: 14px; border: 1px solid #e5e7eb;">
                                ${resetUrl}
                            </p>
                            <div class="warning">
                                <strong>⚠️ Penting:</strong> Link ini hanya berlaku selama <strong>1 jam</strong> dan hanya dapat digunakan sekali.
                            </div>
                            <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
                                Jika Anda tidak meminta reset password, abaikan email ini. Password Anda tidak akan berubah.
                            </p>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} Perpustakaan Universitas Andalas</p>
                            <p>Email ini dikirim secara otomatis, mohon tidak membalas.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        await transporter.sendMail(mailOptions);

        logger(`BERHASIL: Email reset kata sandi dikirim ke '${email}'.`, 'INFO');
        console.log(`✅ Email reset password berhasil dikirim ke ${email}`);

        return res.render('auth/lupapassword', {
            popup: {
                type: 'success',
                title: 'Email Terkirim',
                message: `Link reset password telah dikirim ke ${email}. Silakan cek inbox atau folder spam Anda.`,
            },
        });
    } catch (err) {
        logger(`Kesalahan server di sendResetEmail untuk email '${email}': ${err.message}`, 'ERROR');
        console.error('❌ Error saat mengirim email reset password:', err);
        return res.status(500).render('auth/lupapassword', {
            popup: {
                type: 'error',
                title: 'Kesalahan Server',
                message: 'Terjadi kesalahan saat mengirim email. Silakan coba lagi nanti.',
            },
        });
    }
};

// =====================================================
// GET /reset-password/:token - Tampilkan form reset password
// =====================================================
exports.showResetPassword = async (req, res) => {
    const { token } = req.params;
    const ip = req.ip;
    logger(`MULAI: Halaman showResetPassword diakses dengan token: '${token}' dari IP: ${ip}`, 'INFO');

    try {
        // Validasi token
        const [rows] = await db.query(
            `SELECT * FROM password_reset_tokens 
             WHERE token = ? AND used = 0 AND expires_at > NOW()`,
            [token]
        );

        if (rows.length === 0) {
            logger(`Gagal showResetPassword: Token tidak valid atau sudah kedaluwarsa '${token}' dari IP: ${ip}`, 'WARN');
            return res.render('auth/resetpassword', {
                popup: {
                    type: 'error',
                    title: 'Link Tidak Valid',
                    message: 'Link reset password tidak valid atau sudah kedaluwarsa.',
                },
                token: null,
            });
        }

        logger(`Token '${token}' valid. Merender halaman reset password.`, 'INFO');
        res.render('auth/resetpassword', { popup: null, token });
    } catch (err) {
        logger(`Kesalahan server di showResetPassword untuk token '${token}': ${err.message}`, 'ERROR');
        console.error('❌ Error saat validasi token:', err);
        return res.status(500).render('auth/resetpassword', {
            popup: {
                type: 'error',
                title: 'Kesalahan Server',
                message: 'Terjadi kesalahan pada server.',
            },
            token: null,
        });
    }
};

// =====================================================
// POST /reset-password/:token - Proses reset password
// =====================================================
exports.resetPassword = async (req, res) => {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;
    const ip = req.ip;
    logger(`MULAI: Upaya resetPassword dengan token: '${token}' dari IP: ${ip}`, 'INFO');

    try {
        // Validasi input
        if (!password || !confirmPassword) {
            logger(`resetPassword gagal: Kolom kata sandi kosong untuk token '${token}'`, 'WARN');
            return res.status(400).render('auth/resetpassword', {
                popup: {
                    type: 'warning',
                    title: 'Form Tidak Lengkap',
                    message: 'Mohon isi semua field yang diperlukan.',
                },
                token,
            });
        }

        if (password !== confirmPassword) {
            logger(`resetPassword gagal: Kata sandi tidak cocok untuk token '${token}'`, 'WARN');
            return res.status(400).render('auth/resetpassword', {
                popup: {
                    type: 'error',
                    title: 'Password Tidak Cocok',
                    message: 'Password dan konfirmasi password tidak sama.',
                },
                token,
            });
        }

        if (password.length < 6) {
            logger(`resetPassword gagal: Kata sandi terlalu pendek untuk token '${token}'`, 'WARN');
            return res.status(400).render('auth/resetpassword', {
                popup: {
                    type: 'warning',
                    title: 'Password Terlalu Pendek',
                    message: 'Password minimal 6 karakter.',
                },
                token,
            });
        }

        // Validasi token
        const [tokenRows] = await db.query(
            `SELECT * FROM password_reset_tokens 
             WHERE token = ? AND used = 0 AND expires_at > NOW()`,
            [token]
        );

        if (tokenRows.length === 0) {
            logger(`resetPassword gagal: Token tidak valid atau kedaluwarsa '${token}' saat pengiriman.`, 'WARN');
            return res.status(400).render('auth/resetpassword', {
                popup: {
                    type: 'error',
                    title: 'Link Tidak Valid',
                    message: 'Link reset password tidak valid atau sudah kedaluwarsa.',
                },
                token: null,
            });
        }

        const resetData = tokenRows[0];
        const hashedPassword = await bcrypt.hash(password, 10);
        logger(`Token '${token}' divalidasi untuk email '${resetData.email}'. Meng-hash kata sandi baru.`, 'INFO');

        // Update password berdasarkan user_type
        if (resetData.user_type === 'user') {
            await db.query('UPDATE user SET passwd = ? WHERE user_id = ?', [hashedPassword, resetData.user_id]);
            logger(`Kata sandi diperbarui untuk ID pengguna: ${resetData.user_id}`, 'INFO');
        } else {
            await db.query('UPDATE member SET mpasswd = ? WHERE member_id = ?', [hashedPassword, resetData.member_id]);
            logger(`Kata sandi diperbarui untuk ID anggota: ${resetData.member_id}`, 'INFO');
        }

        // Tandai token sebagai sudah digunakan
        await db.query('UPDATE password_reset_tokens SET used = 1 WHERE token = ?', [token]);
        logger(`Token '${token}' telah ditandai sebagai digunakan.`, 'INFO');

        logger(`BERHASIL: Reset kata sandi untuk email '${resetData.email}'.`, 'INFO');
        console.log(`✅ Password berhasil direset untuk ${resetData.email}`);

        return res.render('auth/resetpassword', {
            popup: {
                type: 'success',
                title: 'Password Berhasil Direset',
                message: 'Password Anda berhasil diubah. Silakan login dengan password baru Anda.',
                redirect: '/login',
            },
            token: null,
        });
    } catch (err) {
        logger(`Kesalahan server di resetPassword untuk token '${token}': ${err.message}`, 'ERROR');
        console.error('❌ Error saat reset password:', err);
        return res.status(500).render('auth/resetpassword', {
            popup: {
                type: 'error',
                title: 'Kesalahan Server',
                message: 'Terjadi kesalahan saat mereset password.',
            },
            token: req.params.token,
        });
    }
};