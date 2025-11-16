const db = require('../../config/db');
const dayjs = require('dayjs');

exports.renderStrukPinjamMini = async (req, res) => {
  const user = req.session.user;
  if (!user || user.role !== 'member') return res.redirect('/login');

  const loanId = req.session.lastLoanId;
  if (!loanId) return res.redirect('/outside/detailPinjam');

  const [rows] = await db.query(`
    SELECT 
      l.loan_id, l.item_code, l.loan_date, l.due_date,
      m.member_id, m.member_name,
      b.title, b.sor AS author
    FROM loan l
    LEFT JOIN member m ON l.member_id = m.member_id
    LEFT JOIN item i ON l.item_code = i.item_code
    LEFT JOIN biblio b ON i.biblio_id = b.biblio_id
    WHERE l.loan_id = ?
    LIMIT 1
  `, [loanId]);

  const trx = rows[0];

  return res.render('outside/strukPinjam-mini', {
    trx: {
      ...trx,
      loan_date: dayjs(trx.loan_date).format('DD MMM YYYY HH:mm'),
      due_date: dayjs(trx.due_date).format('DD MMM YYYY')
    }
  });
};
