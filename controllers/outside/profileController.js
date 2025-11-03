const db = require('../../config/db');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../../utils/logger');

// Inisialisasi logger khusus untuk profil
const logProfile = createLogger('profile.log', { defaultPrefix: '👤' });

exports.renderProfile = async (req, res) => {
    const memberId = req.session.user ? req.session.user.id : 'guest';
    const ip = req.ip;
    logProfile(`Mencoba me-render profil untuk ID anggota: ${memberId} dari IP: ${ip}`, 'INFO');

    try {
        const member = req.session.user;
        if (!member) {
            logProfile(`Gagal me-render profil: Tidak ada pengguna di sesi. Mengalihkan ke login. IP: ${ip}`, 'WARN');
            return res.redirect('/login');
        }

        // Query dengan JOIN ke tabel mst_fakultas
        const [rows] = await db.query(
            `SELECT 
                m.member_id,
                m.member_name,
                m.gender,
                m.birth_date,
                m.member_type_id,
                m.member_address,
                m.member_mail_address,
                m.member_email,
                m.postal_code,
                m.inst_name,
                m.member_phone,
                m.member_fax,
                m.member_since_date,
                m.register_date,
                m.expire_date,
                m.member_notes,
                m.is_pending,
                m.is_new,
                m.mpasswd,
                m.last_login,
                m.last_login_ip,
                m.input_date,
                m.last_update,
                m.member_image,
                m.pin,
                f.fak_name
            FROM member m
            LEFT JOIN mst_fakultas f ON m.inst_name = f.inst_name
            WHERE m.member_id = ?`,
            [member.id]
        );

        if (rows.length === 0) {
            logProfile(`Gagal me-render profil: Data anggota tidak ditemukan di Database untuk ID: ${member.id}. IP: ${ip}`, 'WARN');
            return res.render('outside/profile', {
                title: 'Profil Member',
                member: memberData,
                error: 'Data member tidak ditemukan.',
            });
        }

        const memberData = rows[0];

        // Handle gender text
        memberData.gender_text = memberData.gender === 1 ? 'Laki-laki' : 'Perempuan';

        // Handle member image
        let memberImagePath = '/images/profile-avatar.png'; // Default

        if (memberData.member_image) {
            // Path gambar di server
            const imagePath = path.join(__dirname, '../../public/uploads/profiles/', memberData.member_image);

            // Cek apakah file ada di server
            if (fs.existsSync(imagePath)) {
                memberImagePath = `/uploads/profiles/${memberData.member_image}`;
            } else {
                logProfile(`Gambar tidak ditemukan di server: ${imagePath}, menggunakan gambar default untuk ID anggota: ${member.id}`, 'WARN');
            }
        }

        memberData.profile_image_url = memberImagePath;

        // Format tanggal ke bahasa Indonesia
        memberData.birth_date_formatted = memberData.birth_date ? formatDateIndonesia(memberData.birth_date) : '-';
        memberData.member_since_date_formatted = memberData.member_since_date ? formatDateIndonesia(memberData.member_since_date) : '-';
        memberData.register_date_formatted = memberData.register_date ? formatDateIndonesia(memberData.register_date) : '-';
        memberData.expire_date_formatted = memberData.expire_date ? formatDateIndonesia(memberData.expire_date) : '-';

        logProfile(`Berhasil me-render profil untuk anggota: ${memberData.member_name} (${member.id}). IP: ${ip}`, 'INFO');
        res.render('outside/profile', {
            title: 'Profil Member',
            member: memberData,
            activeNav: 'Profile',
            user: req.session.user,
        });
    } catch (err) {
        logProfile(`Kesalahan server saat me-render profil untuk ID anggota: ${memberId}: ${err.message}`, 'ERROR');
        console.error('❌ Error renderProfile:', err);
        res.status(500).render('outside/profile', {
            title: 'Profil Member',
            member: {},
            error: 'Terjadi kesalahan saat memuat data profil.',
            activeNav: 'Profile',
            user: req.session.user,
        });
    }
};

// Helper function untuk format tanggal Indonesia
function formatDateIndonesia(dateString) {
    if (!dateString) return '-';

    const date = new Date(dateString);
    if (isNaN(date)) return '-';

    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
}

// --- Halaman Edit Profil ---
exports.renderEditProfile = async (req, res) => {
    const memberId = req.session.user ? req.session.user.id : 'guest';
    const ip = req.ip;
    logProfile(`Mencoba me-render halaman edit profil untuk ID anggota: ${memberId} dari IP: ${ip}`, 'INFO');

    try {
        const member = req.session.user;
        if (!member) {
            logProfile(`Gagal me-render halaman edit profil: Tidak ada pengguna di sesi. Mengalihkan ke login. IP: ${ip}`, 'WARN');
            return res.redirect('/login');
        }

        const [rows] = await db.query(
            `SELECT 
                m.member_id,
                m.member_name,
                m.gender,
                m.birth_date,
                m.member_phone,
                m.member_email,
                m.member_address,
                m.member_image
            FROM member m
            WHERE m.member_id = ?`,
            [member.id]
        );

        if (rows.length === 0) {
            logProfile(`Gagal me-render halaman edit profil: Data anggota tidak ditemukan di DB untuk ID: ${member.id}. IP: ${ip}`, 'WARN');
            return res.redirect('/outside/profile');
        }

        const memberData = rows[0];
        memberData.gender_text = memberData.gender === 1 ? 'Laki-laki' : 'Perempuan';

        // Handle member image
        let memberImagePath = '/images/profile-avatar.png';
        if (memberData.member_image) {
            const imagePath = path.join(__dirname, '../../public/uploads/profiles/', memberData.member_image);
            if (fs.existsSync(imagePath)) {
                memberImagePath = `/uploads/profiles/${memberData.member_image}`;
            }
        }
        memberData.profile_image_url = memberImagePath;

        // Format tanggal lahir
        memberData.birth_date_formatted = memberData.birth_date ? formatDateIndonesia(memberData.birth_date) : '-';

        logProfile(`Berhasil me-render halaman edit profil untuk anggota: ${memberData.member_name} (${member.id}). IP: ${ip}`, 'INFO');
        res.render('outside/editProfile', {
            title: 'Edit Profil Member',
            member: memberData,
            activeNav: 'Profile',
            user: req.session.user,
            error: req.flash('error'),
            success: req.flash('success'),
        });
    } catch (err) {
        logProfile(`Kesalahan server saat me-render halaman edit profil untuk ID anggota: ${memberId}: ${err.message}`, 'ERROR');
        console.error('❌ Error renderEditProfile:', err);
        res.status(500).send('Terjadi kesalahan saat memuat halaman edit profil.');
    }
};

// --- Proses Update Profil ---
// --- Proses Update Profil ---
exports.updateProfile = async (req, res) => {
    const memberId = req.session.user ? req.session.user.id : 'guest';
    const ip = req.ip;
    logProfile(`Mencoba memperbarui profil untuk ID anggota: ${memberId} dari IP: ${ip}`, 'INFO');

    try {
        const member = req.session.user;
        if (!member) {
            logProfile(`Gagal memperbarui profil: Tidak ada pengguna di sesi. Mengalihkan ke login. IP: ${ip}`, 'WARN');
            return res.redirect('/login');
        }

        const { member_phone, member_email, member_address } = req.body;

        // Validasi input
        if (member_phone && !/^[0-9]+$/.test(member_phone)) {
            logProfile(`Gagal memperbarui profil untuk ID anggota: ${member.id}: Format nomor telepon tidak valid. IP: ${ip}`, 'WARN');
            req.flash('error', 'Nomor telepon hanya boleh berisi angka!');
            return res.redirect('/outside/editProfile');
        }
        if (member_phone && (member_phone.length < 10 || member_phone.length > 15)) {
            logProfile(`Gagal memperbarui profil untuk ID anggota: ${member.id}: Panjang nomor telepon tidak valid. IP: ${ip}`, 'WARN');
            req.flash('error', 'Nomor telepon harus antara 10-15 digit!');
            return res.redirect('/outside/editProfile');
        }
        if (member_email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(member_email)) {
            logProfile(`Gagal memperbarui profil untuk ID anggota: ${member.id}: Format email tidak valid. IP: ${ip}`, 'WARN');
            req.flash('error', 'Format email tidak valid!');
            return res.redirect('/outside/editProfile');
        }

        // Ambil data lama
        const [oldData] = await db.query('SELECT member_image FROM member WHERE member_id = ?', [member.id]);
        let memberImage = oldData[0]?.member_image || null;

        // Upload baru?
        if (req.file) {
            if (oldData[0]?.member_image) {
                const oldPath = path.join(__dirname, '../../public/uploads/profiles/', oldData[0].member_image);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                    logProfile(`Gambar profil lama dihapus untuk ID anggota: ${member.id}: ${oldPath}`, 'INFO');
                }
            }
            memberImage = req.file.filename;
            logProfile(`Gambar profil baru diunggah untuk ID anggota: ${member.id}: ${memberImage}`, 'INFO');
        }

        // Update DB
        await db.query(
            `
            UPDATE member 
            SET member_phone = ?, 
                member_email = ?, 
                member_address = ?, 
                member_image = ?, 
                last_update = NOW() 
            WHERE member_id = ?
        `,
            [member_phone, member_email, member_address, memberImage, member.id]
        );

        logProfile(`Profil berhasil diperbarui untuk ID anggota: ${member.id}. IP: ${ip}`, 'INFO');

        // 🔄 Refresh data terbaru dari DB untuk session
        const [updatedRows] = await db.query(
            `
            SELECT member_id, member_name, member_email, member_phone, member_image 
            FROM member WHERE member_id = ?
        `,
            [member.id]
        );

        if (updatedRows.length > 0) {
            // Generate profile image URL seperti di authController
            let memberImagePath = '/images/profile-avatar.png'; // Default
            if (updatedRows[0].member_image) {
                const imagePath = path.join(__dirname, '../../public/uploads/profiles/', updatedRows[0].member_image);
                if (fs.existsSync(imagePath)) {
                    memberImagePath = `/uploads/profiles/${updatedRows[0].member_image}`;
                } else {
                    logProfile(`Peringatan: Gambar profil baru tidak ditemukan: ${imagePath}`, 'WARN');
                }
            }

            req.session.user = {
                ...req.session.user,
                member_name: updatedRows[0].member_name,
                member_email: updatedRows[0].member_email,
                member_phone: updatedRows[0].member_phone,
                member_image: updatedRows[0].member_image,
                profile_image_url: memberImagePath, // Tambahkan URL lengkap
            };
            logProfile(`Sesi diperbarui dengan gambar profil baru: ${memberImagePath} untuk ID anggota: ${member.id}.`, 'INFO');
        }

        req.flash('success', 'Profil berhasil diperbarui!');
        res.redirect('/outside/profile');
    } catch (err) {
        logProfile(`Kesalahan server saat pembaruan profil untuk ID anggota: ${memberId}: ${err.message}`, 'ERROR');
        console.error('❌ Error updateProfile:', err);
        req.flash('error', 'Terjadi kesalahan saat memperbarui profil.');
        res.redirect('/outside/editProfile');
    }
};
