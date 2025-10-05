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

    // basic validation
    if (!nim || !password) {
      return res.status(400).render('auth/login', {
        popup: {
          type: 'warning',
          title: 'Form Tidak Lengkap',
          message: 'Mohon isi NIM dan Password terlebih dahulu.',
        },
      });
    }

    // ==========================================
    // 🔍 Cari Member (peminjam)
    // ==========================================
    const [memberRows] = await db.query(
      'SELECT * FROM member WHERE member_id = ?',
      [nim]
    );

    if (memberRows.length === 0) {
      // ==========================================
      // 🔍 Jika bukan member → cek pustakawan
      // ==========================================
      const [userRows] = await db.query(
        'SELECT * FROM user WHERE username = ?',
        [nim]
      );

      if (userRows.length === 0) {
        return res.status(404).render('auth/login', {
          popup: {
            type: 'error',
            title: 'Akun Tidak Ditemukan',
            message:
              'Akun dengan NIM atau Username tersebut belum terdaftar.',
          },
        });
      }

      // found user (pustakawan)
      const user = userRows[0];
      let isMatch = false;

      // cek hash bcrypt
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

      // sukses pustakawan
      req.session.user = {
        id: user.username,
        role: 'pustakawan',
        email: user.email,
        realname: user.realname || user.username,
      };

      return res.status(200).redirect('/inside/peminjaman');
    }

    // ==========================================
    // ✅ Login Member
    // ==========================================
    const member = memberRows[0];
    let isPasswordCorrect = false;

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

    // Cek expire date
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

    // sukses member → simpan session
    req.session.user = {
      id: member.member_id,
      role: 'member',
      email: member.member_email,
      member_name: member.member_name,
    };

    // 🔁 arahkan ke dashboard peminjaman baru
    return res.status(200).redirect('/outside/perpanjangan');
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
