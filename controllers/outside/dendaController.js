// controllers/outside/dendaController.js
const db = require('../../config/db');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);
dayjs.extend(timezone);

// =====================================================
// RENDER INFORMASI DENDA (untuk detailPinjam.ejs)
// =====================================================
exports.renderDenda = async (req, res) => {
  const timestamp = dayjs().tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss');
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${timestamp}] 🚀 START: renderDenda`);
  console.log(`${'='.repeat(60)}`);

  try {
    // Validasi session
    if (!req.session.user || req.session.user.role !== 'member') {
      console.log(`[${timestamp}] ❌ User tidak login atau bukan member`);
      return res.redirect('/login');
    }

    const memberId = req.session.user.member_id;
    console.log(`[${timestamp}] ✅ Member ID: ${memberId}`);

    // =============================
    // 1️⃣ Ambil Aturan Denda per Kategori dari mst_loan_rules
    // =============================
    console.log(`\n[${timestamp}] 📋 Mengambil aturan denda per kategori...`);
    
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

    console.log(`[${timestamp}] ✅ Aturan denda ditemukan: ${rulesRows.length} kategori`);

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
    console.log(`\n[${timestamp}] 📚 Mengambil peminjaman aktif...`);
    
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

    console.log(`[${timestamp}] ✅ Peminjaman aktif: ${loanRows.length} buku`);

    // =============================
    // 3️⃣ Ambil Data Denda dari Tabel fines (SUDAH DIHITUNG oleh liveMonitor.js)
    // =============================
    console.log(`\n[${timestamp}] 💰 Mengambil data denda dari tabel fines...`);
    
    const [finesRows] = await db.query(
      `SELECT 
        f.fines_id,
        f.fines_date,
        f.item_code,
        f.debet,
        f.credit,
        f.description,
        b.title,
        b.image
      FROM fines f
      LEFT JOIN item i ON f.item_code = i.item_code
      LEFT JOIN biblio b ON i.biblio_id = b.biblio_id
      WHERE f.member_id = ?
      ORDER BY f.fines_date DESC`,
      [memberId]
    );

    console.log(`[${timestamp}] ✅ Denda ditemukan: ${finesRows.length} record`);

    // Hitung total denda (debet - credit)
    const totalFines = finesRows.reduce((sum, fine) => 
      sum + ((fine.debet || 0) - (fine.credit || 0)), 0
    );
    console.log(`[${timestamp}] 💵 Total denda: Rp ${totalFines.toLocaleString('id-ID')}`);

    // =============================
    // 4️⃣ Proses Data untuk Setiap Peminjaman
    // =============================
    console.log(`\n[${timestamp}] 🔄 Memproses data peminjaman...`);
    
    const today = dayjs().tz('Asia/Jakarta').startOf('day');
    
    const loansWithFines = loanRows.map((loan, index) => {
      const dueDate = dayjs(loan.due_date).tz('Asia/Jakarta').startOf('day');
      const daysOverdue = today.diff(dueDate, 'day');
      
      console.log(`\n[${timestamp}] 📖 Processing loan ${index + 1}/${loanRows.length}:`);
      console.log(`   - item_code: ${loan.item_code}`);
      console.log(`   - due_date: ${loan.due_date}`);
      console.log(`   - days_overdue: ${daysOverdue}`);
      
      // ✅ Cari denda yang SUDAH ADA di tabel fines (dihitung oleh liveMonitor.js)
      const existingFine = finesRows.find(f => f.item_code === loan.item_code && f.debet > 0);
      
      let fineStatus = 'on_time'; // 'on_time', 'overdue_pending', 'has_fine'
      let calculatedFine = 0;
      let fineDate = null;
      let hasFineRecord = false;
      
      if (existingFine) {
        // ✅ Sudah ada record denda di database (dari liveMonitor.js)
        fineStatus = 'has_fine';
        calculatedFine = existingFine.debet - (existingFine.credit || 0);
        fineDate = existingFine.fines_date;
        hasFineRecord = true;
        console.log(`   ✅ Has fine record: Rp ${calculatedFine.toLocaleString('id-ID')}`);
      } else if (daysOverdue > 0) {
        // ⚠️ Terlambat tapi belum ada record denda (mungkin belum di-process oleh liveMonitor.js)
        fineStatus = 'overdue_pending';
        // Estimasi denda (untuk informasi user)
        calculatedFine = daysOverdue * (loan.fine_each_day || 0);
        // Tanggal denda dihitung sehari setelah deadline
        fineDate = dueDate.add(1, 'day').format('YYYY-MM-DD');
        console.log(`   ⚠️ Overdue but pending calculation`);
        console.log(`   - estimated_fine: Rp ${calculatedFine.toLocaleString('id-ID')}`);
      } else {
        console.log(`   ✅ On time`);
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
        days_overdue: Math.max(0, daysOverdue),
        fine_status: fineStatus,
        calculated_fine: calculatedFine,
        fine_date: fineDate,
        has_fine_record: hasFineRecord
      };
    });

    // =============================
    // 5️⃣ Render ke View
    // =============================
    console.log(`\n[${timestamp}] 🎨 Rendering view...`);
    console.log(`   - fineRules: ${fineRules.length} categories`);
    console.log(`   - loansWithFines: ${loansWithFines.length} loans`);
    console.log(`   - totalFines: Rp ${totalFines.toLocaleString('id-ID')}`);
    
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

    console.log(`[${timestamp}] ✅ Render berhasil`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (err) {
    console.error(`\n[${timestamp}] ❌❌❌ ERROR di renderDenda:`);
    console.error(`   Error Name: ${err.name}`);
    console.error(`   Error Message: ${err.message}`);
    console.error(`   Error Stack:`);
    console.error(err.stack);
    console.log(`${'='.repeat(60)}\n`);

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
    console.error('❌ Error getFineInfo:', err);
    return {
      hasFine: false,
      totalFine: 0,
      fineDate: null
    };
  }
};