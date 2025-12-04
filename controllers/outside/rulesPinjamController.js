// controllers/outside/rulesPinjamController.js
const db = require('../../config/db');
const { createLogger } = require('../../utils/logger');

const logRulesPinjam = createLogger('rules-pinjam.log');

exports.renderRulesPinjam = async (req, res) => {
    logRulesPinjam('START: renderRulesPinjam', 'INFO');
    try {
        // Ambil data user dari session
        const user = req.session.user;

        // Validasi session
        if (!user || user.role !== 'member') {
            logRulesPinjam('Sesi tidak valid atau pengguna bukan member. Mengalihkan ke halaman login.', 'WARN');
            req.session.popup = {
                type: 'error',
                title: 'Sesi Berakhir',
                message: 'Sesi kamu telah berakhir. Silakan login kembali.',
            };
            return res.redirect('/login');
        }

        // Ambil tipe member dari session
        const memberTypeId = user.member_type_id;
        logRulesPinjam(`Mengambil aturan peminjaman untuk member ID: ${user.id} (tipe: ${memberTypeId})`, 'INFO');

        // Query aturan peminjaman berdasarkan tipe member
        const [loanRules] = await db.query(
            `
            SELECT
                lr.loan_rules_id AS id,
                lr.member_type_id,
                mt.member_type_name,
                lr.coll_type_id,
                ct.coll_type_name AS coll_type_name,
                lr.gmd_id,
                lr.loan_limit,
                lr.loan_periode,
                lr.reborrow_limit,
                lr.fine_each_day,
                lr.grace_periode,
                lr.input_date,
                lr.last_update
            FROM mst_loan_rules AS lr
            LEFT JOIN mst_coll_type AS ct ON lr.coll_type_id = ct.coll_type_id
            LEFT JOIN mst_member_type AS mt ON lr.member_type_id = mt.member_type_id
            WHERE lr.member_type_id = ?
            ORDER BY lr.loan_rules_id ASC
            `,
            [memberTypeId]
        );

        logRulesPinjam(`Berhasil menemukan ${loanRules.length} aturan untuk member_type_id=${memberTypeId}.`, 'INFO');

        logRulesPinjam('Rendering halaman rulesPinjam...', 'INFO');
        res.render('outside/rulesPinjam', {
            title: 'Aturan Peminjaman - SIBUDI',
            user,
            loanRules,
            popup: req.session.popup || null,
            activeNav: 'RulesPinjam',
        });

        delete req.session.popup;
        logRulesPinjam('Halaman rulesPinjam berhasil dirender.', 'INFO');

    } catch (error) {
        logRulesPinjam(`ERROR di renderRulesPinjam: ${error.message}`, 'ERROR');

        // Fallback jika terjadi error
        res.render('outside/rulesPinjam', {
            title: 'Aturan Peminjaman - SIBUDI',
            user: req.session.user || {},
            loanRules: [],
            popup: {
                type: 'error',
                title: 'Gagal',
                message: 'Terjadi kesalahan saat memuat halaman Aturan Peminjaman.',
            },
            activeNav: 'RulesPinjam',
        });
    }
};
