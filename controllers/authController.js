// controllers/authController.js
const bcrypt = require('bcrypt');
const db = require('../config/db'); // mysql2/promise pool
const dayjs = require('dayjs');

// =====================================================
// POST /login
// =====================================================
exports.login = async (req, res) => {
    try {
        const { nim, password } = req.body;

        //  Validasi input kosong
        if (!nim || !password) {
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

            console.log(`✅ ${user.username} berhasil login sebagai pustakawan/admin`);

            // Update waktu login & IP pustakawan/admin
            await db.query('UPDATE user SET last_login = NOW(), last_login_ip = ? WHERE user_id = ?', [req.ip, user.user_id]);

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

        console.log(`✅ ${member.member_name} login sebagai member (${member.member_type_name})`);

        //  Update waktu login & IP member
        await db.query('UPDATE member SET last_login = NOW(), last_login_ip = ? WHERE member_id = ?', [req.ip, member.member_id]);

        return res.redirect('/outside/dashboard');
    } catch (err) {
        console.error('❌ Error saat proses login:', err);
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
// GET /logout (untuk member - langsung logout)
// =====================================================
exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('sibudi_session_id'); // cookie session
        res.redirect('/login');
    });
};

// =====================================================
// POST /logout-validate (untuk pustakawan - validasi password)
// =====================================================
exports.validateLogout = async (req, res) => {
    try {
        const { password } = req.body;
        const user = req.session.user;

        // Cek apakah user adalah pustakawan
        if (!user || user.role !== 'pustakawan') {
            return res.status(403).json({
                success: false,
                message: 'Akses ditolak. Hanya pustakawan yang memerlukan validasi password.',
            });
        }

        // Validasi input password
        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password harus diisi untuk logout.',
            });
        }

        // Ambil data user dari database
        const [userRows] = await db.query('SELECT * FROM user WHERE user_id = ?', [user.id]);

        if (userRows.length === 0) {
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
            return res.status(401).json({
                success: false,
                message: 'Password yang Anda masukkan salah.',
            });
        }

        // Password benar, lakukan logout
        req.session.destroy((err) => {
            if (err) {
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
        console.error('❌ Error saat validasi logout:', err);
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
