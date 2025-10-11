const db = require('../../config/db');

exports.renderProfile = async (req, res) => {
    try {
        const member = req.session.user;
        if (!member) {
            return res.redirect('/login');
        }

        const [rows] = await db.query(
            `SELECT 
          member_id,
          member_name,
          gender,
          birth_date,
          member_type_id,
          member_address,
          member_mail_address,
          member_email,
          postal_code,
          inst_name,
          member_phone,
          member_fax,
          member_since_date,
          register_date,
          expire_date,
          member_notes,
          is_pending,
          is_new,
          mpasswd,
          last_login,
          last_login_ip,
          input_date,
          last_update,
          member_image,
          pin
      FROM member
      WHERE member_id = ?`,
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

        memberData.gender_text = memberData.gender === 1 ? 'Laki-laki' : 'Perempuan';

        res.render('outside/profile', {
            title: 'Profil Member',
            member: memberData,
        });
    } catch (err) {
        console.error('❌ Error renderProfile:', err);
        res.status(500).render('outside/profile', {
            title: 'Profil Member',
            member: {},
            error: 'Terjadi kesalahan saat memuat data profil.',
        });
    }
};
