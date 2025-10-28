// controllers/outside/perpanjanganController.js
const db = require('../../config/db');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');
const fs = require('fs');
const path = require('path');

// Extend dayjs dengan timezone
dayjs.extend(utc);
dayjs.extend(timezone);

// Import helper dari peminjamanController
const { calculateDueDate, calculateWorkingDaysOverdue, loadHolidays } = require('../inside/peminjamanController');

// =====================================================
// DASHBOARD PERPANJANGAN (Render Halaman)
// =====================================================
exports.renderPerpanjangan = async (req, res) => {
  const timestamp = dayjs().tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss');
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${timestamp}] 🚀 START: renderPerpanjangan`);
  console.log(`${'='.repeat(60)}`);

  try {
    // Pastikan user login & role = member
    if (!req.session.user || req.session.user.role !== 'member') {
      console.log(`[${timestamp}] ❌ User tidak login atau bukan member`);
      console.log(`   Session User:`, req.session.user);
      return res.redirect('/login');
    }

    const memberId = req.session.user.member_id;
    console.log(`[${timestamp}] ✅ Member ID: ${memberId}`);
    console.log(`[${timestamp}] 👤 Member Name: ${req.session.user.name}`);

    // =============================
    // 1️⃣ Daftar Buku Aktif Dipinjam dengan JOIN ke mst_loan_rules
    // =============================
    console.log(`\n[${timestamp}] 📚 Mengambil data peminjaman dari database...`);
    
    const [loanRows] = await db.query(
      `SELECT 
        loan.loan_id,
        loan.item_code,
        loan.loan_rules_id,
        loan.loan_date,
        loan.due_date,
        loan.renewed,
        item.biblio_id,
        item.coll_type_id,
        item.location_id,
        biblio.title,
        biblio.sor AS author,
        biblio.notes,
        biblio.image,
        biblio.publish_year,
        biblio.collation,
        biblio.language_id,
        biblio.publisher_id,
        mlr.reborrow_limit,
        mlr.loan_periode,
        mlr.fine_each_day
      FROM loan
      JOIN item ON loan.item_code = item.item_code
      JOIN biblio ON item.biblio_id = biblio.biblio_id
      LEFT JOIN mst_loan_rules mlr ON loan.loan_rules_id = mlr.loan_rules_id
      WHERE loan.member_id = ? AND loan.is_return = 0
      ORDER BY loan.loan_date DESC`,
      [memberId]
    );

    console.log(`[${timestamp}] ✅ Query berhasil, total rows: ${loanRows.length}`);
    
    if (loanRows.length > 0) {
      console.log(`[${timestamp}] 📋 Sample data buku pertama:`);
      console.log(`   - loan_id: ${loanRows[0].loan_id}`);
      console.log(`   - item_code: ${loanRows[0].item_code}`);
      console.log(`   - title: ${loanRows[0].title}`);
      console.log(`   - reborrow_limit: ${loanRows[0].reborrow_limit}`);
      console.log(`   - renewed: ${loanRows[0].renewed}`);
    }

    // =============================
    // 2️⃣ PARSING COLLATION & AMBIL DATA TAMBAHAN
    // =============================
    console.log(`\n[${timestamp}] 🔄 Memproses ${loanRows.length} buku...`);
    
    // Load holidays untuk perhitungan hari kerja
    const connection = await db.getConnection();
    const holidays = await loadHolidays(connection);
    connection.release();
    console.log(`[${timestamp}] 📅 Holidays loaded: ${holidays.length} dates`);

    // Load fines data
    const [allFinesRows] = await db.query(
      `SELECT 
        f.fines_id,
        f.fines_date,
        f.debet,
        f.credit,
        f.description
      FROM fines f
      WHERE f.member_id = ?
      ORDER BY f.fines_date DESC`,
      [memberId]
    );
    console.log(`[${timestamp}] 💰 Fines loaded: ${allFinesRows.length} records`);

    const today = dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD');
    
    const loansPromises = loanRows.map(async (b, index) => {
      console.log(`\n[${timestamp}] 📖 Processing book ${index + 1}/${loanRows.length}: ${b.title}`);
      
      let edition = null;
      let pages = null;
      let size = null;

      // Parse collation
      if (b.collation) {
        console.log(`   - Collation raw: "${b.collation}"`);
        const collation = b.collation.trim();

        const editionMatch = collation.match(/^([ivxlcdm]+)\s*,?/i) || 
                            collation.match(/(?:ed\.?|cet\.?)\s*(\d+)/i);
        if (editionMatch) {
          edition = editionMatch[1].toUpperCase();
          console.log(`   - Edition parsed: ${edition}`);
        }

        const pagesMatch = collation.match(/(\d+)\s*(?:hal\.?|hlm\.?)/i);
        if (pagesMatch) {
          pages = `${pagesMatch[1]} Halaman`;
          console.log(`   - Pages parsed: ${pages}`);
        }

        const sizeMatch = collation.match(/(\d+)\s*cm/i);
        if (sizeMatch) {
          size = `${sizeMatch[1]} cm`;
          console.log(`   - Size parsed: ${size}`);
        }
      } else {
        console.log(`   - Collation: NULL`);
      }

      // Image fallback
      let finalImage = '/images/buku.png';
      if (b.image) {
        const imagePath = path.join(__dirname, '../../public', b.image);
        if (fs.existsSync(imagePath)) {
          finalImage = b.image;
          console.log(`   - Image found: ${finalImage}`);
        } else {
          console.log(`   - Image NOT found, using default`);
        }
      }

      // Get language name
      let languageName = null;
      if (b.language_id) {
        const [langRows] = await db.query(
          'SELECT language_name FROM mst_language WHERE language_id = ?',
          [b.language_id]
        );
        if (langRows.length > 0) {
          languageName = langRows[0].language_name;
          console.log(`   - Language: ${languageName}`);
        }
      }

      // Get publisher name
      let publisherName = null;
      if (b.publisher_id) {
        const [pubRows] = await db.query(
          'SELECT publisher_name FROM mst_publisher WHERE publisher_id = ?',
          [b.publisher_id]
        );
        if (pubRows.length > 0) {
          publisherName = pubRows[0].publisher_name;
          console.log(`   - Publisher: ${publisherName}`);
        }
      }

      // Get location name
      let locationName = null;
      if (b.location_id) {
        const [locRows] = await db.query(
          'SELECT location_name FROM mst_location WHERE location_id = ?',
          [b.location_id]
        );
        if (locRows.length > 0) {
          locationName = locRows[0].location_name;
          console.log(`   - Location: ${locationName}`);
        }
      }

      // Get collection type name
      let collTypeName = null;
      if (b.coll_type_id) {
        const [collRows] = await db.query(
          'SELECT coll_type_name FROM mst_coll_type WHERE coll_type_id = ?',
          [b.coll_type_id]
        );
        if (collRows.length > 0) {
          collTypeName = collRows[0].coll_type_name;
          console.log(`   - Collection Type: ${collTypeName}`);
        }
      }

      // Cek apakah reborrow_limit = 0 (tidak bisa diperpanjang)
      const noReborrow = (b.reborrow_limit === 0);
      console.log(`   - reborrow_limit: ${b.reborrow_limit}`);
      console.log(`   - noReborrow flag: ${noReborrow}`);

      // Hitung hari kerja terlambat (skip Minggu & holiday)
      const workingDaysOverdue = calculateWorkingDaysOverdue(b.due_date, today, holidays);

      // Cari denda dari tabel fines
      const existingFine = allFinesRows.find(f => 
        f.description && f.description.includes(b.item_code) && f.debet > 0
      );

      let calculatedFine = 0;
      let fineStatus = 'on_time';
      
      if (existingFine) {
        calculatedFine = existingFine.debet - (existingFine.credit || 0);
        fineStatus = 'has_fine';
      }

      return {
        loan_id: b.loan_id,
        item_code: b.item_code,
        biblio_id: b.biblio_id,
        title: b.title,
        author: b.author || null,
        publish_year: b.publish_year || null,
        collation_pages: pages || null,
        collation_size: size || null,
        language: languageName,
        publisher: publisherName,
        coll_type: collTypeName,
        location: locationName,
        image: finalImage,
        edition,
        loan_date: b.loan_date,
        due_date: b.due_date,
        renewed: b.renewed,
        reborrow_limit: b.reborrow_limit,
        loan_periode: b.loan_periode,
        noReborrow, // Flag untuk disable tombol perpanjangan
        days_overdue: workingDaysOverdue, // Hari kerja terlambat
        calculated_fine: calculatedFine, // Denda dari database
        fine_status: fineStatus,
        fine_per_day: b.fine_each_day || 0
      };
    });

    const loans = await Promise.all(loansPromises);

    console.log(`\n[${timestamp}] ✅ Semua buku berhasil diproses: ${loans.length} buku`);

    // =============================
    // 3️⃣ Total Denda Aktif (langsung dari tabel fines)
    // =============================
    console.log(`\n[${timestamp}] 💰 Mengecek denda aktif dari tabel fines...`);
    
    // Debug: Lihat semua record fines untuk member ini
    const [allFinesDebug] = await db.query(
      `SELECT fines_id, fines_date, debet, credit, description 
       FROM fines 
       WHERE member_id = ? 
       ORDER BY fines_date DESC`,
      [memberId]
    );
    console.log(`[${timestamp}] 📋 Detail semua record fines untuk member ${memberId}:`);
    allFinesDebug.forEach((f, idx) => {
      console.log(`   ${idx + 1}. fines_id=${f.fines_id}, debet=${f.debet}, credit=${f.credit}, net=${f.debet - f.credit}`);
    });
    
    const [fineRows] = await db.query(
      `SELECT 
         COALESCE(SUM(debet), 0) - COALESCE(SUM(credit), 0) AS total_due
       FROM fines
       WHERE member_id = ?`,
      [memberId]
    );
    const totalDenda = fineRows[0]?.total_due || 0;
    
    console.log(`[${timestamp}] ✅ Total denda dari database: Rp ${totalDenda.toLocaleString('id-ID')}`);

    // =============================
    // 4️⃣ Render View
    // =============================
    console.log(`\n[${timestamp}] 🎨 Rendering view: outside/detailPinjam`);
    console.log(`   - loans.length: ${loans.length}`);
    console.log(`   - totalDenda: ${totalDenda}`);
    console.log(`   - activeNav: DetailPinjam`);

    if (loans.length > 0) {
      console.log(`\n[${timestamp}] 📋 Data buku pertama yang akan di-render:`);
      console.log(JSON.stringify(loans[0], null, 2));
    }

    res.render('outside/detailPinjam', {
      title: 'Detail & Perpanjangan Peminjaman',
      loans,
      fineRules: [], // Tidak digunakan di perpanjangan, tapi perlu untuk konsistensi
      finesData: allFinesRows || [],
      totalDenda,
      popup: null,
      activeNav: 'DetailPinjam',
      user: req.session.user
    });

    console.log(`[${timestamp}] ✅ Render berhasil`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (err) {
    console.error(`\n[${timestamp}] ❌❌❌ ERROR di renderPerpanjangan:`);
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
        message: 'Terjadi kesalahan saat memuat data peminjaman.',
      },
      activeNav: 'DetailPinjam',
      user: req.session.user
    });
  }
};

// =====================================================
// PROSES PERPANJANGAN (POST /outside/extend)
// =====================================================
exports.extendLoan = async (req, res) => {
  const timestamp = dayjs().tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss');
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${timestamp}] 🔄 START: extendLoan`);
  console.log(`${'='.repeat(60)}`);

  try {
    console.log(`[${timestamp}] 📥 Request body:`, req.body);

    // 1️⃣ Validasi Session Member
    if (!req.session.user || req.session.user.role !== 'member') {
      console.log(`[${timestamp}] ❌ User tidak login atau bukan member`);
      return res.render('outside/detailPinjam', {
        title: 'Detail & Perpanjangan Peminjaman',
        loans: [],
        fineRules: [],
        finesData: [],
        totalDenda: 0,
        popup: {
          type: 'error',
          title: 'Akses Ditolak',
          message: 'Hanya anggota yang dapat memperpanjang buku.',
          redirect: '/login'
        },
        activeNav: 'DetailPinjam',
        user: req.session.user
      });
    }

    const { loan_id } = req.body;
    const memberId = req.session.user.member_id;

    console.log(`[${timestamp}] ✅ Member ID: ${memberId}`);
    console.log(`[${timestamp}] ✅ Loan ID: ${loan_id}`);

    // Validasi input
    if (!loan_id) {
      console.log(`[${timestamp}] ❌ loan_id kosong`);
      return res.render('outside/detailPinjam', {
        title: 'Detail & Perpanjangan Peminjaman',
        loans: [],
        fineRules: [],
        finesData: [],
        totalDenda: 0,
        popup: {
          type: 'error',
          title: 'Data Tidak Valid',
          message: 'ID peminjaman tidak ditemukan.'
        },
        activeNav: 'DetailPinjam',
        user: req.session.user
      });
    }

    // 2️⃣ Cek Data Loan
    console.log(`\n[${timestamp}] 🔍 Mencari data loan...`);
    
    const [loanRows] = await db.query(
      `SELECT 
        loan.loan_id,
        loan.member_id,
        loan.item_code,
        loan.loan_date,
        loan.due_date,
        loan.return_date,
        loan.renewed,
        loan.is_lent,
        loan.is_return,
        loan.loan_rules_id,
        mlr.reborrow_limit,
        mlr.loan_periode
      FROM loan 
      JOIN item ON loan.item_code = item.item_code
      LEFT JOIN mst_loan_rules mlr ON loan.loan_rules_id = mlr.loan_rules_id
      WHERE loan.loan_id = ? 
        AND loan.member_id = ? 
        AND loan.is_return = 0`,
      [loan_id, memberId]
    );

    console.log(`[${timestamp}] Query result rows: ${loanRows.length}`);

    if (loanRows.length === 0) {
      console.log(`[${timestamp}] ❌ Loan tidak ditemukan`);
      return res.render('outside/detailPinjam', {
        title: 'Detail & Perpanjangan Peminjaman',
        loans: [],
        fineRules: [],
        finesData: [],
        totalDenda: 0,
        popup: {
          type: 'warning',
          title: 'Tidak Ditemukan',
          message: 'Data peminjaman tidak ditemukan atau sudah dikembalikan.'
        },
        activeNav: 'DetailPinjam',
        user: req.session.user
      });
    }

    const loan = loanRows[0];
    console.log(`[${timestamp}] ✅ Loan ditemukan:`);
    console.log(`   - loan_id: ${loan.loan_id}`);
    console.log(`   - item_code: ${loan.item_code}`);
    console.log(`   - loan_date: ${loan.loan_date}`);
    console.log(`   - due_date (CURRENT): ${loan.due_date}`);
    console.log(`   - renewed (CURRENT): ${loan.renewed}`);
    console.log(`   - reborrow_limit: ${loan.reborrow_limit}`);
    console.log(`   - loan_periode: ${loan.loan_periode}`);

    // 3️⃣ Validasi Denda
    console.log(`\n[${timestamp}] 💰 Mengecek denda...`);
    
    const [fineRows] = await db.query(
      'SELECT SUM(debet - credit) AS total_due FROM fines WHERE member_id = ?',
      [memberId]
    );
    const totalDue = fineRows[0].total_due || 0;
    console.log(`[${timestamp}] Total denda: Rp ${totalDue.toLocaleString('id-ID')}`);
    
    if (totalDue > 0) {
      console.log(`[${timestamp}] ❌ Member masih punya denda, perpanjangan ditolak`);
      const loans = await reloadLoans(memberId);
      
      return res.render('outside/detailPinjam', {
        title: 'Detail & Perpanjangan Peminjaman',
        loans,
        fineRules: [],
        finesData: [],
        totalDenda: totalDue,
        popup: {
          type: 'error',
          title: 'Masih Ada Denda',
          message: `Anda masih memiliki denda sebesar Rp ${totalDue.toLocaleString('id-ID')}. Harap lunasi terlebih dahulu.`
        },
        activeNav: 'DetailPinjam',
        user: req.session.user
      });
    }

    // 4️⃣ Validasi Aturan
    if (!loan.reborrow_limit && loan.reborrow_limit !== 0) {
      console.log(`[${timestamp}] ❌ reborrow_limit NULL/undefined`);
      const loans = await reloadLoans(memberId);
      
      return res.render('outside/detailPinjam', {
        title: 'Detail & Perpanjangan Peminjaman',
        loans,
        fineRules: [],
        finesData: [],
        totalDenda: 0,
        popup: {
          type: 'error',
          title: 'Aturan Tidak Ditemukan',
          message: 'Aturan peminjaman tidak ditemukan. Hubungi pustakawan.'
        },
        activeNav: 'DetailPinjam',
        user: req.session.user
      });
    }

    // 5️⃣ Cek reborrow_limit = 0
    if (loan.reborrow_limit === 0) {
      console.log(`[${timestamp}] ⚠️ reborrow_limit = 0, tidak bisa diperpanjang`);
      const loans = await reloadLoans(memberId);
      
      return res.render('outside/detailPinjam', {
        title: 'Detail & Perpanjangan Peminjaman',
        loans,
        fineRules: [],
        finesData: [],
        totalDenda: 0,
        popup: {
          type: 'warning',
          title: 'Tidak Dapat Diperpanjang',
          message: 'Jenis koleksi ini tidak dapat diperpanjang.'
        },
        activeNav: 'DetailPinjam',
        user: req.session.user 
      });
    }

    // 6️⃣ Cek Batas Perpanjangan
    if (loan.renewed >= loan.reborrow_limit) {
      console.log(`[${timestamp}] ⚠️ Batas perpanjangan tercapai (${loan.renewed}/${loan.reborrow_limit})`);
      const loans = await reloadLoans(memberId);
      
      return res.render('outside/detailPinjam', {
        title: 'Detail & Perpanjangan Peminjaman',
        loans,
        fineRules: [],
        finesData: [],
        totalDenda: 0,
        popup: {
          type: 'warning',
          title: 'Batas Tercapai',
          message: `Buku ini sudah mencapai batas maksimum perpanjangan (${loan.reborrow_limit}x).`
        },
        activeNav: 'DetailPinjam',
        user: req.session.user
      });
    }

    // 7️⃣ Hitung Due Date Baru
    console.log(`\n[${timestamp}] 📅 Menghitung due date baru...`);
    
    // PERBAIKAN KRITIS: Format due_date ke YYYY-MM-DD sebelum dikirim ke calculateDueDate
    const currentDueDate = dayjs(loan.due_date).format('YYYY-MM-DD');
    console.log(`   - Due date saat ini (raw): ${loan.due_date}`);
    console.log(`   - Due date saat ini (formatted): ${currentDueDate}`);
    console.log(`   - Perpanjangan ke: ${loan.renewed + 1}`);
    console.log(`   - Loan periode: ${loan.loan_periode} hari kerja`);
    
    const holidays = await loadHolidays(db);
    console.log(`   - Holidays loaded: ${holidays.length} hari libur`);
    
    // PERBAIKAN: Gunakan currentDueDate yang sudah diformat
    // Ini memastikan perpanjangan ke-2 menambah dari hasil perpanjangan ke-1
    const newDueDate = calculateDueDate(currentDueDate, loan.loan_periode, holidays);
    console.log(`   - Due date baru: ${newDueDate}`);
    
    // Hitung selisih hari untuk validasi
    const daysDiff = dayjs(newDueDate).diff(dayjs(currentDueDate), 'day');
    console.log(`   - Selisih kalender: ${daysDiff} hari (termasuk weekend & holiday yang di-skip)`);

    // 8️⃣ Update Database
    console.log(`\n[${timestamp}] 💾 Updating database...`);
    console.log(`   - UPDATE loan SET due_date = '${newDueDate}', renewed = ${loan.renewed + 1} WHERE loan_id = ${loan.loan_id}`);
    
    const [updateResult] = await db.query(
      'UPDATE loan SET due_date = ?, renewed = renewed + 1, last_update = NOW() WHERE loan_id = ?',
      [newDueDate, loan.loan_id]
    );

    console.log(`[${timestamp}] ✅ Database UPDATE result:`);
    console.log(`   - affectedRows: ${updateResult.affectedRows}`);
    console.log(`   - changedRows: ${updateResult.changedRows}`);
    console.log(`   - New due_date: ${newDueDate}`);
    console.log(`   - New renewed: ${loan.renewed + 1}`);
    
    // Verify update dengan SELECT
    const [verifyRows] = await db.query(
      'SELECT due_date, renewed FROM loan WHERE loan_id = ?',
      [loan.loan_id]
    );
    
    if (verifyRows.length > 0) {
      console.log(`\n[${timestamp}] 🔍 Verifikasi data setelah UPDATE:`);
      console.log(`   - due_date di DB: ${verifyRows[0].due_date}`);
      console.log(`   - renewed di DB: ${verifyRows[0].renewed}`);
      console.log(`   - Match dengan expected? ${verifyRows[0].due_date === newDueDate ? '✅ YES' : '❌ NO'}`);
    }

    // 9️⃣ Reload Data
    console.log(`\n[${timestamp}] 🔄 Reloading loans data...`);
    const loans = await reloadLoans(memberId);
    console.log(`[${timestamp}] ✅ Loans reloaded: ${loans.length} buku`);

    // 🔟 Render Success
    console.log(`\n[${timestamp}] ✅ Perpanjangan BERHASIL!`);
    console.log(`${'='.repeat(60)}\n`);

    return res.render('outside/detailPinjam', {
      title: 'Detail & Perpanjangan Peminjaman',
      loans,
      fineRules: [],
      finesData: [],
      totalDenda: 0,
      popup: {
        type: 'success',
        title: 'Perpanjangan Berhasil',
        message: `Buku <b>${loan.item_code}</b> berhasil diperpanjang hingga <b>${dayjs(newDueDate).tz('Asia/Jakarta').format('DD MMMM YYYY')}</b>.`
      },
      activeNav: 'DetailPinjam',
      user: req.session.user
    });

  } catch (err) {
    console.error(`\n[${timestamp}] ❌❌❌ ERROR di extendLoan:`);
    console.error(`   Error Name: ${err.name}`);
    console.error(`   Error Message: ${err.message}`);
    console.error(`   Error Stack:`);
    console.error(err.stack);
    console.log(`${'='.repeat(60)}\n`);
    
    const memberId = req.session.user?.member_id;
    const loans = memberId ? await reloadLoans(memberId) : [];
    
    return res.render('outside/detailPinjam', {
      title: 'Detail & Perpanjangan Peminjaman',
      loans,
      fineRules: [],
      finesData: [],
      totalDenda: 0,
      popup: {
        type: 'error',
        title: 'Kesalahan Server',
        message: 'Terjadi kesalahan pada server. Silakan coba lagi.'
      },
      activeNav: 'DetailPinjam',
      user: req.session.user
    });
  }
};

// =====================================================
// HELPER: Reload Loans Data
// =====================================================
async function reloadLoans(memberId) {
  const timestamp = dayjs().tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss');
  console.log(`\n[${timestamp}] 🔄 reloadLoans called for member: ${memberId}`);

  const [loanRows] = await db.query(
    `SELECT 
      loan.loan_id,
      loan.item_code,
      loan.loan_rules_id,
      loan.loan_date,
      loan.due_date,
      loan.renewed,
      item.biblio_id,
      item.coll_type_id,
      item.location_id,
      biblio.title,
      biblio.sor AS author,
      biblio.notes,
      biblio.image,
      biblio.publish_year,
      biblio.collation,
      biblio.language_id,
      biblio.publisher_id,
      mlr.reborrow_limit,
      mlr.loan_periode,
      mlr.fine_each_day
    FROM loan
    JOIN item ON loan.item_code = item.item_code
    JOIN biblio ON item.biblio_id = biblio.biblio_id
    LEFT JOIN mst_loan_rules mlr ON loan.loan_rules_id = mlr.loan_rules_id
    WHERE loan.member_id = ? AND loan.is_return = 0
    ORDER BY loan.loan_date DESC`,
    [memberId]
  );

  console.log(`[${timestamp}] ✅ Reload query result: ${loanRows.length} rows`);

  // Load holidays untuk perhitungan hari kerja
  const connection = await db.getConnection();
  const holidays = await loadHolidays(connection);
  connection.release();
  console.log(`[${timestamp}] 📅 Holidays loaded: ${holidays.length} dates`);

  // Load fines data untuk mencocokkan dengan loan
  const [finesRows] = await db.query(
    `SELECT 
      f.fines_id,
      f.fines_date,
      f.debet,
      f.credit,
      f.description
    FROM fines f
    WHERE f.member_id = ?
    ORDER BY f.fines_date DESC`,
    [memberId]
  );
  console.log(`[${timestamp}] 💰 Fines loaded: ${finesRows.length} records`);

  const today = dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD');

  const loansPromises = loanRows.map(async (b) => {
    let edition = null;
    let pages = null;
    let size = null;

    if (b.collation) {
      const collation = b.collation.trim();
      const editionMatch = collation.match(/^([ivxlcdm]+)\s*,?/i) || 
                          collation.match(/(?:ed\.?|cet\.?)\s*(\d+)/i);
      if (editionMatch) edition = editionMatch[1].toUpperCase();

      const pagesMatch = collation.match(/(\d+)\s*(?:hal\.?|hlm\.?)/i);
      if (pagesMatch) pages = `${pagesMatch[1]} Halaman`;

      const sizeMatch = collation.match(/(\d+)\s*cm/i);
      if (sizeMatch) size = `${sizeMatch[1]} cm`;
    }

    let finalImage = '/images/buku.png';
    if (b.image) {
      const imagePath = path.join(__dirname, '../../public', b.image);
      if (fs.existsSync(imagePath)) finalImage = b.image;
    }

    let languageName = null;
    if (b.language_id) {
      const [langRows] = await db.query(
        'SELECT language_name FROM mst_language WHERE language_id = ?',
        [b.language_id]
      );
      if (langRows.length > 0) languageName = langRows[0].language_name;
    }

    let publisherName = null;
    if (b.publisher_id) {
      const [pubRows] = await db.query(
        'SELECT publisher_name FROM mst_publisher WHERE publisher_id = ?',
        [b.publisher_id]
      );
      if (pubRows.length > 0) publisherName = pubRows[0].publisher_name;
    }

    let locationName = null;
    if (b.location_id) {
      const [locRows] = await db.query(
        'SELECT location_name FROM mst_location WHERE location_id = ?',
        [b.location_id]
      );
      if (locRows.length > 0) locationName = locRows[0].location_name;
    }

    let collTypeName = null;
    if (b.coll_type_id) {
      const [collRows] = await db.query(
        'SELECT coll_type_name FROM mst_coll_type WHERE coll_type_id = ?',
        [b.coll_type_id]
      );
      if (collRows.length > 0) collTypeName = collRows[0].coll_type_name;
    }

    const noReborrow = (b.reborrow_limit === 0);

    // ✅ Hitung hari kerja terlambat (skip Minggu & holiday)
    const workingDaysOverdue = calculateWorkingDaysOverdue(b.due_date, today, holidays);

    // ✅ Cari denda dari tabel fines
    const existingFine = finesRows.find(f => 
      f.description && f.description.includes(b.item_code) && f.debet > 0
    );

    let calculatedFine = 0;
    let fineStatus = 'on_time';
    
    if (existingFine) {
      calculatedFine = existingFine.debet - (existingFine.credit || 0);
      fineStatus = 'has_fine';
    }

    return {
      loan_id: b.loan_id,
      item_code: b.item_code,
      biblio_id: b.biblio_id,
      title: b.title,
      author: b.author || null,
      publish_year: b.publish_year || null,
      collation_pages: pages || null,
      collation_size: size || null,
      language: languageName,
      publisher: publisherName,
      coll_type: collTypeName,
      location: locationName,
      image: finalImage,
      edition,
      loan_date: b.loan_date,
      due_date: b.due_date,
      renewed: b.renewed,
      reborrow_limit: b.reborrow_limit,
      loan_periode: b.loan_periode,
      noReborrow,
      days_overdue: workingDaysOverdue, // ✅ Hari kerja terlambat
      calculated_fine: calculatedFine, // ✅ Denda dari database
      fine_status: fineStatus,
      fine_per_day: b.fine_each_day || 0
    };
  });

  const result = await Promise.all(loansPromises);
  console.log(`[${timestamp}] ✅ reloadLoans completed: ${result.length} loans processed`);
  
  return result;
}