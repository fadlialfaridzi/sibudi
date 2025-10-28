// controllers/authController.js
const bcrypt = require('bcrypt');
const db = require('../config/db'); // mysql2/promise pool
const dayjs = require('dayjs');
const { createLogger } = require('../utils/logger');

// Inisialisasi logger khusus untuk otentikasi
const logAuth = createLogger('auth.log', { defaultPrefix: '🔒' });

// =====================================================
// POST /login
// =====================================================
exports.login = async (req, res) => {
    try {
        const { nim, password } = req.body;
        const ip = req.ip;

        //  Validasi input kosong
        if (!nim || !password) {
            logAuth(`Login attempt failed: Empty NIM or password from IP: ${ip}`, 'WARN');
            return res.status(400).render('auth/login', {
                popup: {
                    type: 'warning',
                    title: 'Form Tidak Lengkap',
                    message: 'Mohon isi Username/NIM dan Password terlebih dahulu.',
                },
            });
        }

        // =====================================================
        // 1️⃣ Coba login sebagai pustakawan/admin (tabel user)
        // =====================================================
        const [userRows] = await db.query('SELECT * FROM user WHERE username = ?', [nim]);

        if (userRows.length > 0) {
            const user = userRows[0];
            let isMatch = false;

            // 🔐 Cek hash bcrypt / plaintext
            if (typeof user.passwd === 'string' && user.passwd.match(/^\$2[aby]\$/)) {
                isMatch = await bcrypt.compare(password, user.passwd);
            } else {
                isMatch = password === user.passwd;
            }

            if (!isMatch) {
                logAuth(`Login failed: Incorrect password for user '${nim}' from IP: ${ip}`, 'WARN');
                return res.status(401).render('auth/login', {
                    popup: {
                        type: 'error',
                        title: 'Login Gagal',
                        message: 'Username atau Password tidak sesuai.',
                    },
                });
            }

            //  Login berhasil → set session pustakawan/admin
            req.session.user = {
                id: user.user_id,
                username: user.username,
                realname: user.realname || user.username,
                role: 'pustakawan',
                email: user.email || '-',
            };

            logAuth(`Login successful: User '${user.username}' (pustakawan) logged in from IP: ${ip}`, 'INFO');

            // Update waktu login & IP pustakawan/admin
            await db.query('UPDATE user SET last_login = NOW(), last_login_ip = ? WHERE user_id = ?', [ip, user.user_id]);

            return res.redirect('/inside/peminjaman');
        }

        // =====================================================
        // 2️⃣ Jika tidak ditemukan di user → cek member
        // =====================================================
        const [memberRows] = await db.query(
            `
            SELECT m.*, t.member_type_name 
            FROM member AS m
            LEFT JOIN mst_member_type AS t ON m.member_type_id = t.member_type_id
            WHERE m.member_id = ?
        `,
            [nim]
        );

        if (memberRows.length === 0) {
            logAuth(`Login failed: Account not found for NIM/Username '${nim}' from IP: ${ip}`, 'WARN');
            return res.status(404).render('auth/login', {
                popup: {
                    type: 'error',
                    title: 'Akun Tidak Ditemukan',
                    message: 'Akun dengan NIM atau Username tersebut belum terdaftar.',
                },
            });
        }

        const member = memberRows[0];
        let isPasswordCorrect = false;

        //  Cek password member (bcrypt atau plaintext)
        if (typeof member.mpasswd === 'string' && member.mpasswd.match(/^\$2[aby]\$/)) {
            isPasswordCorrect = await bcrypt.compare(password, member.mpasswd);
        } else {
            isPasswordCorrect = password === member.mpasswd;
        }

        if (!isPasswordCorrect) {
            logAuth(`Login failed: Incorrect password for member '${nim}' from IP: ${ip}`, 'WARN');
            return res.status(401).render('auth/login', {
                popup: {
                    type: 'error',
                    title: 'Login Gagal',
                    message: 'NIM atau Password yang Anda masukkan tidak sesuai.',
                },
            });
        }

        //  Cek keanggotaan expired
        const today = dayjs().format('YYYY-MM-DD');
        if (member.expire_date && dayjs(member.expire_date).isBefore(today)) {
            logAuth(`Login failed: Expired membership for member '${nim}' from IP: ${ip}`, 'WARN');
            return res.status(403).render('auth/login', {
                popup: {
                    type: 'warning',
                    title: 'Keanggotaan Kedaluwarsa',
                    message: 'Keanggotaan Anda telah kedaluwarsa. Silakan hubungi pustakawan.',
                },
            });
        }

        //  Login berhasil → set session member
        req.session.user = {
            id: member.member_id,
            member_id: member.member_id,
            name: member.member_name,
            role: 'member',
            email: member.member_email,
            memberType: member.member_type_name || '-',
            member_type_id: member.member_type_id,
        };

        logAuth(`Login successful: Member '${member.member_name}' (${nim}) logged in from IP: ${ip}`, 'INFO');

        //  Update waktu login & IP member
        await db.query('UPDATE member SET last_login = NOW(), last_login_ip = ? WHERE member_id = ?', [ip, member.member_id]);

        return res.redirect('/outside/dashboard');
    } catch (err) {
        logAuth(`Server error during login process for '${req.body.nim}': ${err.message}`, 'ERROR');
        console.error('❌ Error saat proses login:', err); // Keep console for immediate visibility
        return res.status(500).render('auth/login', {
            popup: {
                type: 'error',
                title: 'Kesalahan Server',
                message: 'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.',
            },
        });
    }
};

// =====================================================
// GET /logout (untuk member & pustakawan tanpa validasi)
// =====================================================
exports.logout = (req, res) => {
    const user = req.session.user;
    const ip = req.ip;

    if (user) {
        logAuth(`Logout successful: User '${user.username || user.name}' (${user.role}) logged out from IP: ${ip}.`, 'INFO');
    } else {
        logAuth(`Logout attempt from a session without user data from IP: ${ip}.`, 'WARN');
    }

    req.session.destroy(() => {
        res.clearCookie('sibudi_session_id'); // cookie session
        res.redirect('/login');
    });
};

// =====================================================
// POST /logout-validate (untuk pustakawan - validasi password)
// =====================================================
exports.validateLogout = async (req, res) => {
    const user = req.session.user;
    const ip = req.ip;

    try {
        const { password } = req.body;

        // Cek apakah user adalah pustakawan
        if (!user || user.role !== 'pustakawan') {
            logAuth(`Logout validation failed: Attempt by non-pustakawan user or no session from IP: ${ip}`, 'WARN');
            return res.status(403).json({
                success: false,
                message: 'Akses ditolak. Hanya pustakawan yang memerlukan validasi password.',
            });
        }

        // Validasi input password
        if (!password) {
            logAuth(`Logout validation failed: Empty password for user '${user.username}' from IP: ${ip}`, 'WARN');
            return res.status(400).json({
                success: false,
                message: 'Password harus diisi untuk logout.',
            });
        }

        // Ambil data user dari database
        const [userRows] = await db.query('SELECT * FROM user WHERE user_id = ?', [user.id]);

        if (userRows.length === 0) {
            logAuth(`Logout validation failed: User '${user.username}' not found in DB for validation. IP: ${ip}`, 'ERROR');
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan.',
            });
        }

        const userData = userRows[0];
        let isPasswordCorrect = false;

        // Cek password (bcrypt atau plaintext)
        if (typeof userData.passwd === 'string' && userData.passwd.match(/^\$2[aby]\$/)) {
            isPasswordCorrect = await bcrypt.compare(password, userData.passwd);
        } else {
            isPasswordCorrect = password === userData.passwd;
        }

        if (!isPasswordCorrect) {
            logAuth(`Logout validation failed: Incorrect password for user '${user.username}' from IP: ${ip}`, 'WARN');
            return res.status(401).json({
                success: false,
                message: 'Password yang Anda masukkan salah.',
            });
        }

        // Password benar, lakukan logout
        logAuth(`Logout validation successful for user '${user.username}'. Proceeding to log out. IP: ${ip}`, 'INFO');
        req.session.destroy((err) => {
            if (err) {
                logAuth(`Server error during session destruction for '${user.username}': ${err.message}`, 'ERROR');
                return res.status(500).json({
                    success: false,
                    message: 'Terjadi kesalahan saat logout.',
                });
            }
            res.clearCookie('sibudi_session_id');
            return res.json({
                success: true,
                message: 'Logout berhasil.',
                redirect: '/login',
            });
        });
    } catch (err) {
        const username = user ? user.username : 'unknown';
        logAuth(`Server error during logout validation for '${username}': ${err.message}`, 'ERROR');
        console.error('❌ Error saat validasi logout:', err); // Keep console for immediate visibility
        return res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server.',
        });
    }
};

// =====================================================
// GET /login
// =====================================================
exports.showLogin = (req, res) => {
    res.render('auth/login', { popup: null });
};
