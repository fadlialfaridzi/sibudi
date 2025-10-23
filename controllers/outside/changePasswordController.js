const db = require('../../config/db');
const bcrypt = require('bcrypt');

// Render halaman ubah password
exports.renderChangePassword = async (req, res) => {
    try {
        const member = req.session.user;
        if (!member) return res.redirect('/login');

        res.render('outside/changePassword', {
            title: 'Ubah Password',
            success: null,
            error: null,
        });
    } catch (err) {
        console.error('❌ Error renderChangePassword:', err);
        res.status(500).render('outside/changePassword', {
            title: 'Ubah Password',
            success: null,
            error: 'Terjadi kesalahan saat memuat halaman ubah password.',
        });
    }
};

// Proses ubah password
exports.updatePassword = async (req, res) => {
    try {
        const member = req.session.user;
        if (!member) return res.redirect('/login');

        const { oldPassword, newPassword, confirmPassword } = req.body;

        // Validasi input
        if (!oldPassword || !newPassword || !confirmPassword) {
            return res.render('outside/changePassword', {
                title: 'Ubah Password',
                error: 'Semua kolom wajib diisi!',
                success: null,
            });
        }

        if (newPassword !== confirmPassword) {
            return res.render('outside/changePassword', {
                title: 'Ubah Password',
                error: 'Password baru dan konfirmasi tidak cocok!',
                success: null,
            });
        }

        // Ambil password lama dari database
        const [rows] = await db.query('SELECT mpasswd FROM member WHERE member_id = ?', [member.id]);
        if (rows.length === 0) {
            return res.render('outside/changePassword', {
                title: 'Ubah Password',
                error: 'Member tidak ditemukan!',
                success: null,
            });
        }

        const hashedPassword = rows[0].mpasswd;

        // Cek apakah password lama cocok
        const isMatch = await bcrypt.compare(oldPassword, hashedPassword);
        if (!isMatch) {
            return res.render('outside/changePassword', {
                title: 'Ubah Password',
                error: 'Password lama salah!',
                success: null,
            });
        }

        // Hash password baru dan update ke database
        const newHashed = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE member SET mpasswd = ?, last_update = NOW() WHERE member_id = ?', [newHashed, member.id]);

        console.log(`✅ Password berhasil diubah untuk member ID: ${member.id}`);
        res.render('outside/changePassword', {
            title: 'Ubah Password',
            success: 'Password berhasil diperbarui!',
            error: null,
        });
    } catch (err) {
        console.error('❌ Error updatePassword:', err);
        res.status(500).render('outside/changePassword', {
            title: 'Ubah Password',
            success: null,
            error: 'Terjadi kesalahan saat memperbarui password.',
        });
    }
};
