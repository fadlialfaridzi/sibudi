const db = require('../../config/db'); // mysql2/promise pool

exports.renderDenda = async (req, res) => {
    try {
        const member = req.session.user;
        if (!member) {
            return res.redirect('/login');
        }

        // Ambil daftar denda dengan join ke item, biblio, dan loan 
        // loan_date akan merepresentasikan tanggal peminjaman atau perpanjangan terakhir
        const [rows] = await db.query(
            `
            SELECT 
                f.fines_id,
                f.fines_date,
                f.member_id,
                f.debet,
                f.credit,
                f.description,
                b.title AS book_title,
                l.loan_date,
                l.due_date
            FROM fines f
            LEFT JOIN item i 
                ON i.item_code = SUBSTRING_INDEX(f.description, ' ', -1)
            LEFT JOIN biblio b 
                ON b.biblio_id = i.biblio_id
            LEFT JOIN loan l 
                ON l.item_code = i.item_code AND l.member_id = f.member_id
            WHERE f.member_id = ? AND f.debet > 0
            ORDER BY f.fines_date DESC
            `,
            [member.id]
        );

        // Hitung total denda dari kolom debet
        const totalFines = rows.reduce((sum, fine) => sum + (fine.debet || 0), 0);

        res.render('outside/denda', {
            title: 'Informasi Denda',
            member,
            fines: rows,
            totalFines,
        });
    } catch (err) {
        console.error('❌ Error renderDenda:', err);
        res.status(500).render('outside/denda', {
            title: 'Informasi Denda',
            member: req.session.user || {},
            fines: [],
            totalFines: 0,
            error: 'Terjadi kesalahan saat mengambil data denda.',
        });
    }
};
