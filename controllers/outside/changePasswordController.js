const db = require('../../config/db');
const bcrypt = require('bcrypt');
const { createLogger } = require('../../utils/logger');

// Inisialisasi logger khusus untuk otentikasi, dengan prefix berbeda
const logPasswordChange = createLogger('password-changes.log', { defaultPrefix: '🔑' });

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
        const memberId = req.session.user ? req.session.user.id : 'unknown';
        logPasswordChange(`Server error when rendering change password page for member ID: ${memberId}. Error: ${err.message}`, 'ERROR');
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
    const member = req.session.user;
    const ip = req.ip;

    try {
        if (!member) {
            logPasswordChange(`Unauthorized attempt to change password from IP: ${ip} (no session).`, 'WARN');
            return res.redirect('/login');
        }

        const { oldPassword, newPassword, confirmPassword } = req.body;

        // Validasi input
        if (!oldPassword || !newPassword || !confirmPassword) {
            logPasswordChange(`Change password failed for member '${member.id}': All fields are required. IP: ${ip}`, 'WARN');
            return res.render('outside/changePassword', {
                title: 'Ubah Password',
                error: 'Semua kolom wajib diisi!',
                success: null,
            });
        }

        if (newPassword !== confirmPassword) {
            logPasswordChange(`Change password failed for member '${member.id}': New passwords do not match. IP: ${ip}`, 'WARN');
            return res.render('outside/changePassword', {
                title: 'Ubah Password',
                error: 'Password baru dan konfirmasi tidak cocok!',
                success: null,
            });
        }

        // Ambil password lama dari database
        const [rows] = await db.query('SELECT mpasswd FROM member WHERE member_id = ?', [member.id]);
        if (rows.length === 0) {
            logPasswordChange(`Change password failed: Member '${member.id}' not found in database. IP: ${ip}`, 'ERROR');
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
            logPasswordChange(`Change password failed for member '${member.id}': Incorrect old password. IP: ${ip}`, 'WARN');
            return res.render('outside/changePassword', {
                title: 'Ubah Password',
                error: 'Password lama salah!',
                success: null,
            });
        }

        // Hash password baru dan update ke database
        const newHashed = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE member SET mpasswd = ?, last_update = NOW() WHERE member_id = ?', [newHashed, member.id]);

        logPasswordChange(`Password changed successfully for member '${member.id}'. IP: ${ip}`, 'INFO');
        res.render('outside/changePassword', {
            title: 'Ubah Password',
            success: 'Password berhasil diperbarui!',
            error: null,
        });
    } catch (err) {
        const memberId = member ? member.id : 'unknown';
        logPasswordChange(`Server error during password update for member '${memberId}': ${err.message}. IP: ${ip}`, 'ERROR');
        console.error('❌ Error updatePassword:', err);
        res.status(500).render('outside/changePassword', {
            title: 'Ubah Password',
            success: null,
            error: 'Terjadi kesalahan saat memperbarui password.',
        });
    }
};