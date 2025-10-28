// controllers/outside/dendaController.js
const db = require('../../config/db');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { calculateWorkingDaysOverdue, loadHolidays } = require('../inside/peminjamanController');
const { createLogger } = require('../../utils/logger');

dayjs.extend(utc);
dayjs.extend(timezone);

const logDenda = createLogger('fines.log', { defaultPrefix: '💰' });

// =====================================================
// RENDER INFORMASI DENDA (untuk detailPinjam.ejs)
// =====================================================
exports.renderDenda = async (req, res) => {
  const timestamp = dayjs().tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss');
  logDenda(`START: renderDenda`, 'INFO');

  try {
    // Validasi session
    if (!req.session.user || req.session.user.role !== 'member') {
      logDenda(`User tidak login atau bukan member`, 'WARN');
      return res.redirect('/login');
    }

    const memberId = req.session.user.member_id;
    logDenda(`Member ID: ${memberId}`, 'INFO');

    // =============================
    // 1️⃣ Ambil Aturan Denda per Kategori dari mst_loan_rules
    // =============================
    logDenda(`Mengambil aturan denda per kategori...`, 'INFO');
    
    const [rulesRows] = await db.query(
      `SELECT 
        mlr.loan_rules_id,
        mlr.loan_rules_name,
        mlr.fine_each_day,
        mlr.loan_periode,
        mlr.reborrow_limit,
        mct.coll_type_name,
        mmt.member_type_name
      FROM mst_loan_rules mlr
      LEFT JOIN mst_coll_type mct ON mlr.coll_type_id = mct.coll_type_id
      LEFT JOIN mst_member_type mmt ON mlr.member_type_id = mmt.member_type_id
      ORDER BY mlr.loan_rules_id ASC`
    );

    logDenda(`Aturan denda ditemukan: ${rulesRows.length} kategori`, 'INFO');

    // Format aturan denda
    const fineRules = rulesRows.map(rule => ({
      id: rule.loan_rules_id,
      name: rule.loan_rules_name,
      collType: rule.coll_type_name || 'Umum',
      memberType: rule.member_type_name || 'Umum',
      finePerDay: rule.fine_each_day || 0,
      loanPeriod: rule.loan_periode || 0,
      reborrowLimit: rule.reborrow_limit || 0
    }));

    // =============================
    // 2️⃣ Ambil Daftar Peminjaman Aktif
    // =============================
    logDenda(`Mengambil peminjaman aktif...`, 'INFO');
    
    const [loanRows] = await db.query(
      `SELECT 
        l.loan_id,
        l.item_code,
        l.loan_date,
        l.due_date,
        l.renewed,
        b.title,
        b.image,
        mlr.fine_each_day,
        mlr.loan_rules_name
      FROM loan l
      JOIN item i ON l.item_code = i.item_code
      JOIN biblio b ON i.biblio_id = b.biblio_id
      LEFT JOIN mst_loan_rules mlr ON l.loan_rules_id = mlr.loan_rules_id
      WHERE l.member_id = ? AND l.is_return = 0
      ORDER BY l.due_date ASC`,
      [memberId]
    );

    logDenda(`Peminjaman aktif: ${loanRows.length} buku`, 'INFO');

    // =============================
    // 3️⃣ Ambil Data Denda dari Tabel fines (SUDAH DIHITUNG oleh liveMonitor.js)
    // CATATAN: Tabel fines TIDAK punya kolom item_code
    // Kita extract item_code dari description yang formatnya: "Denda keterlambatan buku B001234"
    // =============================
    logDenda(`Mengambil data denda dari tabel fines...`, 'INFO');
    
    const [finesRows] = await db.query(
      `SELECT 
        f.fines_id,
        f.fines_date,
        f.debet,
        f.credit,
        f.description
      FROM fines f
      WHERE f.member_id = ? AND f.debet > 0
      ORDER BY f.fines_date DESC`,
      [memberId]
    );

    logDenda(`Denda ditemukan: ${finesRows.length} record`, 'INFO');

    // Hitung total denda (debet - credit)
    const totalFines = finesRows.reduce((sum, fine) => 
      sum + ((fine.debet || 0) - (fine.credit || 0)), 0
    );
    logDenda(`Total denda: Rp ${totalFines.toLocaleString('id-ID')}`, 'INFO');

    // Parse item_code dari description dan ambil info buku
    const finesWithDetails = await Promise.all(
      finesRows.map(async (fine) => {
        // Extract item_code dari description (format: "Denda keterlambatan buku B001234")
        const match = fine.description.match(/buku\s+([A-Z0-9]+)/i);
        const itemCode = match ? match[1] : null;
        
        let bookTitle = null;
        let bookImage = null;
        
        if (itemCode) {
          const [bookRows] = await db.query(
            `SELECT b.title, b.image 
             FROM item i 
             LEFT JOIN biblio b ON i.biblio_id = b.biblio_id 
             WHERE i.item_code = ?`,
            [itemCode]
          );
          
          if (bookRows.length > 0) {
            bookTitle = bookRows[0].title;
            bookImage = bookRows[0].image;
          }
        }
        
        return {
          ...fine,
          item_code: itemCode,
          title: bookTitle,
          image: bookImage || '/images/buku.png'
        };
      })
    );

    // =============================
    // 4️⃣ Load Holidays untuk Perhitungan Hari Kerja
    // =============================
    logDenda(`Loading holidays...`, 'INFO');
    const connection = await db.getConnection();
    const holidays = await loadHolidays(connection);
    connection.release();
    logDenda(`Holidays loaded: ${holidays.length} dates`, 'INFO');

    // =============================
    // 5️⃣ Proses Data untuk Setiap Peminjaman
    // =============================
    logDenda(`Memproses data peminjaman...`, 'INFO');
    const today = dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD');
    
    const loansWithFines = loanRows.map((loan, index) => {
      logDenda(`Processing loan ${index + 1}/${loanRows.length}: item_code: ${loan.item_code}, due_date: ${loan.due_date}`, 'INFO');
      
      // ✅ Cari denda yang SUDAH DIHITUNG oleh liveMonitor.js di tabel fines
      const existingFine = finesRows.find(f => 
        f.description && f.description.includes(loan.item_code) && f.debet > 0
      );
      
      let fineStatus = 'on_time'; // 'on_time', 'has_fine'
      let calculatedFine = 0;
      let fineDate = null;
      let hasFineRecord = false;
      let workingDaysOverdue = 0;
      
      // ✅ Hitung hari kerja terlambat dengan benar (skip Minggu & holiday)
      workingDaysOverdue = calculateWorkingDaysOverdue(loan.due_date, today, holidays);
      
      if (existingFine) {
        // ✅ Sudah ada record denda di database (dihitung oleh liveMonitor.js)
        fineStatus = 'has_fine';
        calculatedFine = existingFine.debet - (existingFine.credit || 0);
        fineDate = existingFine.fines_date;
        hasFineRecord = true;
        
        logDenda(`Has fine record: Rp ${calculatedFine.toLocaleString('id-ID')} (${workingDaysOverdue} working days)`, 'INFO');
      } else if (workingDaysOverdue > 0) {
        // ⚠️ Terlambat tapi belum ada record denda (belum diproses liveMonitor)
        logDenda(`Overdue ${workingDaysOverdue} working days, but no fine record yet`, 'WARN');
      } else {
        logDenda(`On time (no fine record)`, 'INFO');
      }
      
      return {
        loan_id: loan.loan_id,
        item_code: loan.item_code,
        title: loan.title,
        image: loan.image || '/images/buku.png',
        loan_date: loan.loan_date,
        due_date: loan.due_date,
        renewed: loan.renewed,
        fine_per_day: loan.fine_each_day || 0,
        rule_name: loan.loan_rules_name,
        days_overdue: workingDaysOverdue, // ✅ Hari kerja terlambat (skip Minggu & holiday)
        fine_status: fineStatus,
        calculated_fine: calculatedFine, // Dari database (sudah benar)
        fine_date: fineDate,
        has_fine_record: hasFineRecord
      };
    });

    // =============================
    // 6️⃣ Render ke View
    // =============================
    logDenda(`Rendering view...`, 'INFO');
    
    res.render('outside/detailPinjam', {
      title: 'Detail & Perpanjangan Peminjaman',
      loans: loansWithFines,
      fineRules: fineRules,
      finesData: finesRows,
      totalDenda: totalFines,
      popup: null,
      activeNav: 'DetailPinjam',
      user: req.session.user
    });

    logDenda(`Render berhasil`, 'INFO');

  } catch (err) {
    logDenda(`ERROR di renderDenda: ${err.message}`, 'ERROR');

    res.render('outside/detailPinjam', {
      title: 'Detail & Perpanjangan Peminjaman',
      loans: [],
      fineRules: [],
      finesData: [],
      totalDenda: 0,
      popup: {
        type: 'error',
        title: 'Kesalahan Server',
        message: 'Terjadi kesalahan saat memuat data denda.',
      },
      activeNav: 'DetailPinjam',
      user: req.session.user
    });
  }
};

// =====================================================
// HELPER: Get Fine Info untuk Single Loan (Optional)
// =====================================================
exports.getFineInfo = async (memberId, itemCode) => {
  try {
    const [fineRows] = await db.query(
      `SELECT 
         SUM(debet) as total_debet,
         SUM(credit) as total_credit,
         MIN(fines_date) as first_fine_date
       FROM fines
       WHERE member_id = ? AND item_code = ?`,
      [memberId, itemCode]
    );

    if (fineRows.length > 0 && fineRows[0].total_debet > 0) {
      return {
        hasFine: true,
        totalFine: (fineRows[0].total_debet || 0) - (fineRows[0].total_credit || 0),
        fineDate: fineRows[0].first_fine_date
      };
    }

    return {
      hasFine: false,
      totalFine: 0,
      fineDate: null
    };
  } catch (err) {
    logDenda(`Error getFineInfo: ${err.message}`, 'ERROR');
    return {
      hasFine: false,
      totalFine: 0,
      fineDate: null
    };
  }
};