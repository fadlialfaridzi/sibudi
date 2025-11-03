// controllers/outside/perpanjanganController.js
const db = require('../../config/db');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../../utils/logger');

// Inisialisasi logger khusus untuk perpanjangan
const logger = createLogger('perpanjangan.log');

// Extend dayjs dengan timezone
dayjs.extend(utc);
dayjs.extend(timezone);

// Import helper dari peminjamanController
const { calculateDueDate, calculateWorkingDaysOverdue, loadHolidays } = require('../inside/peminjamanController');

// =====================================================
// DASHBOARD PERPANJANGAN (Render Halaman)
// =====================================================
exports.renderPerpanjangan = async (req, res) => {
  const memberId = req.session.user ? req.session.user.member_id : 'Guest';
  const ip = req.ip;
  logger(`MULAI: renderPerpanjangan untuk memberId: ${memberId} dari IP: ${ip}`, 'INFO');

  try {
    // Pastikan user login & role = member
    if (!req.session.user || req.session.user.role !== 'member') {
      logger(`Upaya akses tidak sah ke halaman renderPerpanjangan dari IP: ${ip}`, 'WARN');
      return res.redirect('/login');
    }

    logger(`Mengambil data pinjaman aktif untuk memberId: ${memberId}`, 'INFO');
    
    const [loanRows] = await db.query(
      `SELECT 
        loan.loan_id, loan.item_code, loan.loan_rules_id, loan.loan_date, loan.due_date, loan.renewed,
        item.biblio_id, item.coll_type_id, item.location_id,
        biblio.title, biblio.sor AS author, biblio.notes, biblio.image, biblio.publish_year, biblio.collation, biblio.language_id, biblio.publisher_id,
        mlr.reborrow_limit, mlr.loan_periode, mlr.fine_each_day
      FROM loan
      JOIN item ON loan.item_code = item.item_code
      JOIN biblio ON item.biblio_id = biblio.biblio_id
      LEFT JOIN mst_loan_rules mlr ON loan.loan_rules_id = mlr.loan_rules_id
      WHERE loan.member_id = ? AND loan.is_return = 0
      ORDER BY loan.loan_date DESC`,
      [memberId]
    );

    logger(`Ditemukan ${loanRows.length} pinjaman aktif untuk memberId: ${memberId}`, 'INFO');
    
    const connection = await db.getConnection();
    const holidays = await loadHolidays(connection);
    connection.release();

    const [allFinesRows] = await db.query(
      `SELECT f.fines_id, f.fines_date, f.debet, f.credit, f.description FROM fines f WHERE f.member_id = ? ORDER BY f.fines_date DESC`,
      [memberId]
    );

    const today = dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD');
    
    const loansPromises = loanRows.map(async (b) => {
      let edition = null, pages = null, size = null;
      if (b.collation) {
        const collation = b.collation.trim();
        const editionMatch = collation.match(/^([ivxlcdm]+)\s*,?/i) || collation.match(/(?:ed\.?|cet\.?)\s*(\d+)/i);
        if (editionMatch) edition = editionMatch[1].toUpperCase();
        const pagesMatch = collation.match(/(\d+)\s*(?:hal\.?|hlm\.?)/i);
        if (pagesMatch) pages = `${pagesMatch[1]} Halaman`;
        const sizeMatch = collation.match(/(\d+)\s*cm/i);
        if (sizeMatch) size = `${sizeMatch[1]} cm`;
      }

      let finalImage = '/images/buku.png';
      if (b.image && fs.existsSync(path.join(__dirname, '../../public', b.image))) {
        finalImage = b.image;
      }

      const [[langRows], [pubRows], [locRows], [collRows]] = await Promise.all([
        b.language_id ? db.query('SELECT language_name FROM mst_language WHERE language_id = ?', [b.language_id]) : Promise.resolve([[]]),
        b.publisher_id ? db.query('SELECT publisher_name FROM mst_publisher WHERE publisher_id = ?', [b.publisher_id]) : Promise.resolve([[]]),
        b.location_id ? db.query('SELECT location_name FROM mst_location WHERE location_id = ?', [b.location_id]) : Promise.resolve([[]]),
        b.coll_type_id ? db.query('SELECT coll_type_name FROM mst_coll_type WHERE coll_type_id = ?', [b.coll_type_id]) : Promise.resolve([[]])
      ]);

      const workingDaysOverdue = calculateWorkingDaysOverdue(b.due_date, today, holidays);
      const existingFine = allFinesRows.find(f => f.description && f.description.includes(b.item_code) && f.debet > 0);
      let calculatedFine = 0, fineStatus = 'on_time';
      if (existingFine) {
        calculatedFine = existingFine.debet - (existingFine.credit || 0);
        fineStatus = 'has_fine';
      }

      return {
        loan_id: b.loan_id, item_code: b.item_code, biblio_id: b.biblio_id, title: b.title, author: b.author || null,
        publish_year: b.publish_year || null, collation_pages: pages || null, collation_size: size || null,
        language: langRows[0]?.language_name, publisher: pubRows[0]?.publisher_name, coll_type: collRows[0]?.coll_type_name,
        location: locRows[0]?.location_name, image: finalImage, edition, loan_date: b.loan_date, due_date: b.due_date,
        renewed: b.renewed, reborrow_limit: b.reborrow_limit, loan_periode: b.loan_periode, noReborrow: (b.reborrow_limit === 0),
        days_overdue: workingDaysOverdue, calculated_fine: calculatedFine, fine_status: fineStatus, fine_per_day: b.fine_each_day || 0
      };
    });

    const loans = await Promise.all(loansPromises);
    logger(`Berhasil memproses ${loans.length} pinjaman untuk dirender bagi memberId: ${memberId}`, 'INFO');

    const [fineRows] = await db.query(`SELECT COALESCE(SUM(debet), 0) - COALESCE(SUM(credit), 0) AS total_due FROM fines WHERE member_id = ?`, [memberId]);
    const totalDenda = fineRows[0]?.total_due || 0;
    logger(`Total denda aktif untuk memberId: ${memberId} adalah Rp ${totalDenda}`, 'INFO');

    res.render('outside/detailPinjam', {
      title: 'Detail & Perpanjangan Peminjaman', loans, fineRules: [], finesData: allFinesRows || [],
      totalDenda, popup: null, activeNav: 'DetailPinjam', user: req.session.user
    });
    logger(`Berhasil merender halaman perpanjangan untuk memberId: ${memberId}`, 'INFO');

  } catch (err) {
    logger(`Kesalahan server di renderPerpanjangan untuk memberId: ${memberId}. Kesalahan: ${err.message}`, 'ERROR');
    console.error('❌ Error di renderPerpanjangan:', err);
    res.render('outside/detailPinjam', {
      title: 'Detail & Perpanjangan Peminjaman', loans: [], fineRules: [], finesData: [], totalDenda: 0,
      popup: { type: 'error', title: 'Kesalahan Server', message: 'Terjadi kesalahan saat memuat data peminjaman.' },
      activeNav: 'DetailPinjam', user: req.session.user
    });
  }
};

// =====================================================
// PROSES PERPANJANGAN (POST /outside/extend)
// =====================================================
exports.extendLoan = async (req, res) => {
  const memberId = req.session.user ? req.session.user.member_id : 'Guest';
  const { loan_id } = req.body;
  const ip = req.ip;
  logger(`MULAI: Memperpanjang peminjaman untuk loan_id: ${loan_id} oleh memberId: ${memberId} dari IP: ${ip}`, 'INFO');

  try {
    if (!req.session.user || req.session.user.role !== 'member') {
      logger(`Upaya perpanjangan pinjaman tidak sah dari IP: ${ip}`, 'WARN');
      return res.status(403).render('outside/detailPinjam', {
        title: 'Detail & Perpanjangan Peminjaman', loans: [], fineRules: [], finesData: [], totalDenda: 0,
        popup: { type: 'error', title: 'Akses Ditolak', message: 'Hanya anggota yang dapat memperpanjang buku.', redirect: '/login' },
        activeNav: 'DetailPinjam', user: req.session.user
      });
    }

    if (!loan_id) {
      logger(`Perpanjangan pinjaman gagal: loan_id tidak ada untuk memberId: ${memberId}`, 'WARN');
      const loans = await reloadLoans(memberId, ip);
      return res.status(400).render('outside/detailPinjam', {
        title: 'Detail & Perpanjangan Peminjaman', loans, fineRules: [], finesData: [], totalDenda: 0,
        popup: { type: 'error', title: 'Data Tidak Valid', message: 'ID peminjaman tidak ditemukan.' },
        activeNav: 'DetailPinjam', user: req.session.user
      });
    }

    const [loanRows] = await db.query(
      `SELECT l.*, mlr.reborrow_limit, mlr.loan_periode FROM loan l 
       LEFT JOIN mst_loan_rules mlr ON l.loan_rules_id = mlr.loan_rules_id
       WHERE l.loan_id = ? AND l.member_id = ? AND l.is_return = 0`,
      [loan_id, memberId]
    );

    if (loanRows.length === 0) {
      logger(`Perpanjangan pinjaman gagal: Pinjaman tidak ditemukan untuk loan_id: ${loan_id}, memberId: ${memberId}`, 'WARN');
      const loans = await reloadLoans(memberId, ip);
      return res.status(404).render('outside/detailPinjam', {
        title: 'Detail & Perpanjangan Peminjaman', loans, fineRules: [], finesData: [], totalDenda: 0,
        popup: { type: 'warning', title: 'Tidak Ditemukan', message: 'Data peminjaman tidak ditemukan atau sudah dikembalikan.' },
        activeNav: 'DetailPinjam', user: req.session.user
      });
    }

    const loan = loanRows[0];
    const [fineRows] = await db.query('SELECT SUM(debet - credit) AS total_due FROM fines WHERE member_id = ?', [memberId]);
    const totalDue = fineRows[0].total_due || 0;

    if (totalDue > 0) {
      logger(`Perpanjangan pinjaman gagal: Anggota ${memberId} memiliki denda sebesar Rp ${totalDue}`, 'WARN');
      const loans = await reloadLoans(memberId, ip);
      return res.render('outside/detailPinjam', {
        title: 'Detail & Perpanjangan Peminjaman', loans, fineRules: [], finesData: [], totalDenda: totalDue,
        popup: { type: 'error', title: 'Masih Ada Denda', message: `Anda masih memiliki denda sebesar Rp ${totalDue.toLocaleString('id-ID')}. Harap lunasi terlebih dahulu.` },
        activeNav: 'DetailPinjam', user: req.session.user
      });
    }

    if (loan.reborrow_limit === 0) {
      logger(`Perpanjangan pinjaman gagal: Koleksi dengan loan_id ${loan_id} tidak dapat dipinjam ulang (batas adalah 0) untuk memberId: ${memberId}`, 'INFO');
      const loans = await reloadLoans(memberId, ip);
      return res.render('outside/detailPinjam', {
        title: 'Detail & Perpanjangan Peminjaman', loans, fineRules: [], finesData: [], totalDenda: 0,
        popup: { type: 'warning', title: 'Tidak Dapat Diperpanjang', message: 'Jenis koleksi ini tidak dapat diperpanjang.' },
        activeNav: 'DetailPinjam', user: req.session.user
      });
    }

    if (loan.renewed >= loan.reborrow_limit) {
      logger(`Perpanjangan pinjaman gagal: Batas peminjaman ulang tercapai untuk loan_id: ${loan_id} (${loan.renewed}/${loan.reborrow_limit}) untuk memberId: ${memberId}`, 'INFO');
      const loans = await reloadLoans(memberId, ip);
      return res.render('outside/detailPinjam', {
        title: 'Detail & Perpanjangan Peminjaman', loans, fineRules: [], finesData: [], totalDenda: 0,
        popup: { type: 'warning', title: 'Batas Tercapai', message: `Buku ini sudah mencapai batas maksimum perpanjangan (${loan.reborrow_limit}x).` },
        activeNav: 'DetailPinjam', user: req.session.user
      });
    }

    const holidays = await loadHolidays(db);
    const currentDueDate = dayjs(loan.due_date).format('YYYY-MM-DD');
    const newDueDate = calculateDueDate(currentDueDate, loan.loan_periode, holidays);
    logger(`Menghitung tanggal jatuh tempo baru untuk loan_id: ${loan_id}. Current: ${currentDueDate}, New: ${newDueDate}`, 'INFO');

    await db.query('UPDATE loan SET due_date = ?, renewed = renewed + 1, last_update = NOW() WHERE loan_id = ?', [newDueDate, loan.loan_id]);
    logger(`BERHASIL: Perpanjangan pinjaman berhasil untuk loan_id: ${loan_id} oleh memberId: ${memberId}. Tanggal jatuh tempo baru: ${newDueDate}`, 'INFO');

    const loans = await reloadLoans(memberId, ip);
    return res.render('outside/detailPinjam', {
      title: 'Detail & Perpanjangan Peminjaman', loans, fineRules: [], finesData: [], totalDenda: 0,
      popup: { type: 'success', title: 'Perpanjangan Berhasil', message: `Buku berhasil diperpanjang hingga <b>${dayjs(newDueDate).tz('Asia/Jakarta').format('DD MMMM YYYY')}</b>.` },
      activeNav: 'DetailPinjam', user: req.session.user
    });

  } catch (err) {
    logger(`Kesalahan server di extendLoan untuk memberId: ${memberId}, loan_id: ${loan_id}. Kesalahan: ${err.message}`, 'ERROR');
    console.error('❌ Error di extendLoan:', err);
    const loans = memberId !== 'Guest' ? await reloadLoans(memberId, ip) : [];
    return res.render('outside/detailPinjam', {
      title: 'Detail & Perpanjangan Peminjaman', loans, fineRules: [], finesData: [], totalDenda: 0,
      popup: { type: 'error', title: 'Kesalahan Server', message: 'Terjadi kesalahan pada server. Silakan coba lagi.' },
      activeNav: 'DetailPinjam', user: req.session.user
    });
  }
};

// =====================================================
// HELPER: Reload Loans Data
// =====================================================
async function reloadLoans(memberId, ip = 'N/A') {
  logger(`Memuat ulang data pinjaman untuk memberId: ${memberId}, IP: ${ip}`, 'INFO');
  try {
    const [loanRows] = await db.query(
      `SELECT 
        l.loan_id, l.item_code, l.loan_rules_id, l.loan_date, l.due_date, l.renewed,
        i.biblio_id, i.coll_type_id, i.location_id,
        b.title, b.sor AS author, b.notes, b.image, b.publish_year, b.collation, b.language_id, b.publisher_id,
        mlr.reborrow_limit, mlr.loan_periode, mlr.fine_each_day
      FROM loan l
      JOIN item i ON l.item_code = i.item_code
      JOIN biblio b ON i.biblio_id = b.biblio_id
      LEFT JOIN mst_loan_rules mlr ON l.loan_rules_id = mlr.loan_rules_id
      WHERE l.member_id = ? AND l.is_return = 0
      ORDER BY l.loan_date DESC`,
      [memberId]
    );

    const connection = await db.getConnection();
    const holidays = await loadHolidays(connection);
    connection.release();

    const [finesRows] = await db.query(`SELECT f.fines_id, f.fines_date, f.debet, f.credit, f.description FROM fines f WHERE f.member_id = ? ORDER BY f.fines_date DESC`, [memberId]);
    const today = dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD');

    const loansPromises = loanRows.map(async (loan) => {
      let edition = null, pages = null, size = null;
      if (loan.collation) {
        const collation = loan.collation.trim();
        const editionMatch = collation.match(/^([ivxlcdm]+)\s*,?/i) || collation.match(/(?:ed\.?|cet\.?)\s*(\d+)/i);
        if (editionMatch) edition = editionMatch[1].toUpperCase();
        const pagesMatch = collation.match(/(\d+)\s*(?:hal\.?|hlm\.?)/i);
        if (pagesMatch) pages = `${pagesMatch[1]} Halaman`;
        const sizeMatch = collation.match(/(\d+)\s*cm/i);
        if (sizeMatch) size = `${sizeMatch[1]} cm`;
      }

      let finalImage = '/images/buku.png';
      if (loan.image && fs.existsSync(path.join(__dirname, '../../public', loan.image))) {
        finalImage = loan.image;
      }

      const [[langRows], [pubRows], [locRows], [collRows]] = await Promise.all([
        loan.language_id ? db.query('SELECT language_name FROM mst_language WHERE language_id = ?', [loan.language_id]) : Promise.resolve([[]]),
        loan.publisher_id ? db.query('SELECT publisher_name FROM mst_publisher WHERE publisher_id = ?', [loan.publisher_id]) : Promise.resolve([[]]),
        loan.location_id ? db.query('SELECT location_name FROM mst_location WHERE location_id = ?', [loan.location_id]) : Promise.resolve([[]]),
        loan.coll_type_id ? db.query('SELECT coll_type_name FROM mst_coll_type WHERE coll_type_id = ?', [loan.coll_type_id]) : Promise.resolve([[]])
      ]);

      const workingDaysOverdue = calculateWorkingDaysOverdue(loan.due_date, today, holidays);
      const existingFine = finesRows.find(f => f.description && f.description.includes(loan.item_code) && f.debet > 0);
      let calculatedFine = 0, fineStatus = 'on_time';
      if (existingFine) {
        calculatedFine = existingFine.debet - (existingFine.credit || 0);
        fineStatus = 'has_fine';
      }

      return {
        loan_id: loan.loan_id, item_code: loan.item_code, biblio_id: loan.biblio_id, title: loan.title, author: loan.author || null,
        publish_year: loan.publish_year || null, collation_pages: pages || null, collation_size: size || null,
        language: langRows[0]?.language_name, publisher: pubRows[0]?.publisher_name, coll_type: collRows[0]?.coll_type_name,
        location: locRows[0]?.location_name, image: finalImage, edition, loan_date: loan.loan_date, due_date: loan.due_date,
        renewed: loan.renewed, reborrow_limit: loan.reborrow_limit, loan_periode: loan.loan_periode, noReborrow: (loan.reborrow_limit === 0),
        days_overdue: workingDaysOverdue, calculated_fine: calculatedFine, fine_status: fineStatus, fine_per_day: loan.fine_each_day || 0
      };
    });

    const result = await Promise.all(loansPromises);
    logger(`Pemuatan ulang data pinjaman selesai: ${result.length} pinjaman diproses untuk memberId: ${memberId}`, 'INFO');
    return result;
  } catch (err) {
    logger(`Kesalahan di memuat ulang data peminjaman untuk memberId: ${memberId}. Kesalahan: ${err.message}`, 'ERROR');
    console.error('❌ Error di reloadLoans:', err);
    return []; // Return empty array on error
  }
}
