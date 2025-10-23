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

    // ===============================
    // 🔍 Validasi input kosong
    // ===============================
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
    const [userRows] = await db.query(
      'SELECT * FROM user WHERE username = ?',
      [nim]
    );

    if (userRows.length > 0) {
      const user = userRows[0];
      let isMatch = false;

      // Cek hash bcrypt
      if (
        typeof user.passwd === 'string' &&
        (user.passwd.startsWith('$2a$') ||
          user.passwd.startsWith('$2b$') ||
          user.passwd.startsWith('$2y$'))
      ) {
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

      // ✅ Login berhasil → set session pustakawan/admin
      req.session.user = {
        id: user.username,
        role: 'pustakawan',
        email: user.email || '-',
        realname: user.realname || user.username,
      };

      console.log(`✅ ${user.username} berhasil login sebagai pustakawan/admin`);
      return res.redirect('/inside/peminjaman');
    }

    // =====================================================
    // 2️⃣ Jika tidak ditemukan di user → cek member
    // =====================================================
    const [memberRows] = await db.query(
      'SELECT * FROM member WHERE member_id = ?',
      [nim]
    );

    if (memberRows.length === 0) {
      return res.status(404).render('auth/login', {
        popup: {
          type: 'error',
          title: 'Akun Tidak Ditemukan',
          message:
            'Akun dengan NIM atau Username tersebut belum terdaftar.',
        },
      });
    }

    const member = memberRows[0];
    let isPasswordCorrect = false;

    // Cek password member (bcrypt atau plaintext)
    if (
      typeof member.mpasswd === 'string' &&
      (member.mpasswd.startsWith('$2a$') ||
        member.mpasswd.startsWith('$2b$') ||
        member.mpasswd.startsWith('$2y$'))
    ) {
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

    // Cek keanggotaan expired
    const today = dayjs().format('YYYY-MM-DD');
    if (member.expire_date && dayjs(member.expire_date).isBefore(today)) {
      return res.status(403).render('auth/login', {
        popup: {
          type: 'warning',
          title: 'Keanggotaan Kedaluwarsa',
          message:
            'Keanggotaan Anda telah kedaluwarsa. Silakan hubungi pustakawan.',
        },
      });
    }

    // ✅ Login berhasil → set session member
    req.session.user = {
      id: member.member_id,
      role: 'member',
      email: member.member_email,
      member_name: member.member_name,
    };

    console.log(`✅ ${member.member_name} login sebagai member`);
    return res.redirect('/outside/dashboard');
  } catch (err) {
    console.error('❌ Error saat proses login:', err);
    return res.status(500).render('auth/login', {
      popup: {
        type: 'error',
        title: 'Kesalahan Server',
        message:
          'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.',
      },
    });
  }
};

// =====================================================
// GET /logout
// =====================================================
exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sibudi_session_id'); // cookie session
    res.redirect('/login');
  });
};

// =====================================================
// GET /login
// =====================================================
exports.showLogin = (req, res) => {
  res.render('auth/login', { popup: null });
};
