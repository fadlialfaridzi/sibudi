const db = require('../../config/db');
const fs = require('fs');
const path = require('path');

exports.renderProfile = async (req, res) => {
    try {
        const member = req.session.user;
        if (!member) {
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
            return res.render('outside/profile', {
                title: 'Profil Member',
                member: {},
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
            const imagePath = path.join(__dirname, '../../public/uploads', memberData.member_image);
            
            // Cek apakah file ada di server
            if (fs.existsSync(imagePath)) {
                memberImagePath = `/uploads/${memberData.member_image}`;
            } else {
                console.log(`⚠️ Image not found on server: ${imagePath}, using default`);
            }
        }

        memberData.profile_image_url = memberImagePath;

        // Format tanggal ke bahasa Indonesia
        memberData.birth_date_formatted = memberData.birth_date 
            ? formatDateIndonesia(memberData.birth_date) 
            : '-';
        memberData.member_since_date_formatted = memberData.member_since_date 
            ? formatDateIndonesia(memberData.member_since_date) 
            : '-';
        memberData.register_date_formatted = memberData.register_date 
            ? formatDateIndonesia(memberData.register_date) 
            : '-';
        memberData.expire_date_formatted = memberData.expire_date 
            ? formatDateIndonesia(memberData.expire_date) 
            : '-';

        res.render('outside/profile', {
            title: 'Profil Member',
            member: memberData,
            activeNav: 'Profile',
            user: req.session.user
        });
    } catch (err) {
        console.error('❌ Error renderProfile:', err);
        res.status(500).render('outside/profile', {
            title: 'Profil Member',
            member: {},
            error: 'Terjadi kesalahan saat memuat data profil.',
            activeNav: 'Profile',
            user: req.session.user
        });
    }
};

// Helper function untuk format tanggal Indonesia
function formatDateIndonesia(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    if (isNaN(date)) return '-';
    
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
}

// --- Halaman Edit Profil ---
exports.renderEditProfile = async (req, res) => {
    try {
        const member = req.session.user;
        if (!member) {
            return res.redirect('/login');
        }

        const [rows] = await db.query('SELECT * FROM member WHERE member_id = ?', [member.id]);
        if (rows.length === 0) {
            return res.redirect('/outside/profile');
        }

        const memberData = rows[0];
        memberData.gender_text = memberData.gender === 1 ? 'Laki-laki' : 'Perempuan';

        res.render('outside/editProfile', {
            title: 'Edit Profil Member',
            member: memberData,
            activeNav: 'Profile',
            user: req.session.user
        });
    } catch (err) {
        console.error('❌ Error renderEditProfile:', err);
        res.status(500).send('Terjadi kesalahan saat memuat halaman edit profil.');
    }
};

// --- Proses Update Profil ---
exports.updateProfile = async (req, res) => {
    try {
        const member = req.session.user;
        if (!member) {
            return res.redirect('/login');
        }

        const { member_name, gender_text, member_phone, member_email, member_address } = req.body;

        // Convert gender text ke numeric
        const gender = gender_text === 'Laki-laki' ? 1 : 2;

        await db.query(
            `UPDATE member 
             SET member_name = ?, 
                 gender = ?, 
                 member_phone = ?, 
                 member_email = ?, 
                 member_address = ?, 
                 last_update = NOW()
             WHERE member_id = ?`,
            [member_name, gender, member_phone, member_email, member_address, member.id]
        );

        console.log('✅ Profil berhasil diperbarui untuk:', member.id);
        res.redirect('/outside/profile');
    } catch (err) {
        console.error('❌ Error updateProfile:', err);
        res.status(500).send('Gagal memperbarui profil.');
    }
};