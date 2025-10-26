// =====================================================
// public/js/denda.js — Handler untuk Informasi Denda
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ Denda handler aktif");
  
    // =====================================================
    // 1️⃣ RENDER INFO DENDA PER KATEGORI
    // =====================================================
    const fineRulesContainer = document.querySelector("#fine-rules-container");
    const fineRulesData = document.querySelector("#fine-rules-data");
  
    if (fineRulesContainer && fineRulesData) {
      try {
        const fineRules = JSON.parse(fineRulesData.textContent || "[]");
        console.log("📋 Fine rules loaded:", fineRules);
  
        if (fineRules.length > 0) {
          renderFineRules(fineRules);
        }
      } catch (err) {
        console.error("❌ Error parsing fine rules:", err);
      }
    }
  
    // =====================================================
    // 2️⃣ RENDER INFO DENDA UNTUK SETIAP BUKU
    // =====================================================
    const finesContainer = document.querySelector("#fines-container");
    const loansWithFinesData = document.querySelector("#loans-with-fines-data");
  
    if (finesContainer && loansWithFinesData) {
      try {
        const loansWithFines = JSON.parse(loansWithFinesData.textContent || "[]");
        console.log("💰 Loans with fines loaded:", loansWithFines);
  
        if (loansWithFines.length > 0) {
          renderLoanFines(loansWithFines);
        } else {
          showNoFinesMessage();
        }
      } catch (err) {
        console.error("❌ Error parsing loans with fines:", err);
      }
    }
  
    // =====================================================
    // 3️⃣ FUNGSI: Render Aturan Denda per Kategori
    // =====================================================
    function renderFineRules(rules) {
      fineRulesContainer.innerHTML = "";
  
      const header = document.createElement("div");
      header.className = "mb-6";
      header.innerHTML = `
        <h3 class="text-xl font-bold text-[#2F7A33] mb-2">
          <i class="fa-solid fa-scale-balanced mr-2"></i>
          Denda per Kategori Buku
        </h3>
        <p class="text-sm text-gray-600">
          Denda yang dikenakan berbeda-beda tergantung jenis koleksi dan kategori anggota
        </p>
      `;
      fineRulesContainer.appendChild(header);
  
      const grid = document.createElement("div");
      grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";
  
      rules.forEach((rule) => {
        const card = document.createElement("div");
        card.className =
          "bg-white rounded-xl p-5 border-2 border-gray-200 hover:border-[#2F7A33] transition-all shadow-sm hover:shadow-md";
  
        card.innerHTML = `
          <div class="flex items-start gap-3 mb-3">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-100 to-orange-100 flex items-center justify-center flex-shrink-0">
              <i class="fa-solid fa-coins text-yellow-600"></i>
            </div>
            <div class="flex-1">
              <h4 class="font-bold text-gray-800 text-sm mb-1">${rule.name || 'Aturan Umum'}</h4>
              <p class="text-xs text-gray-600">${rule.collType} • ${rule.memberType}</p>
            </div>
          </div>
  
          <div class="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-3 border border-red-200">
            <div class="text-center">
              <p class="text-xs text-gray-600 mb-1">Denda per Hari</p>
              <p class="text-2xl font-bold text-red-600">
                Rp ${rule.finePerDay.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
  
          <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div class="bg-gray-50 rounded-lg p-2 text-center">
              <p class="text-gray-500 mb-0.5">Masa Pinjam</p>
              <p class="font-semibold text-gray-800">${rule.loanPeriod} hari</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-2 text-center">
              <p class="text-gray-500 mb-0.5">Perpanjangan</p>
              <p class="font-semibold text-gray-800">${rule.reborrowLimit}x</p>
            </div>
          </div>
        `;
  
        grid.appendChild(card);
      });
  
      fineRulesContainer.appendChild(grid);
    }
  
    // =====================================================
    // 4️⃣ FUNGSI: Render Denda untuk Setiap Pinjaman
    // =====================================================
    function renderLoanFines(loans) {
      finesContainer.innerHTML = "";
  
      const header = document.createElement("div");
      header.className = "mb-6";
      header.innerHTML = `
        <h3 class="text-xl font-bold text-[#2F7A33] mb-2">
          <i class="fa-solid fa-receipt mr-2"></i>
          Status Denda Peminjaman Anda
        </h3>
        <p class="text-sm text-gray-600">
          Informasi detail denda untuk setiap buku yang Anda pinjam
        </p>
      `;
      finesContainer.appendChild(header);
  
      const list = document.createElement("div");
      list.className = "space-y-4";
  
      loans.forEach((loan) => {
        const card = document.createElement("div");
        card.className =
          "bg-white rounded-xl p-5 border-2 border-gray-200 hover:border-[#2F7A33] transition-all shadow-sm";
  
        // Tentukan status badge dan styling
        let statusBadge = "";
        let fineInfo = "";
  
        if (loan.fine_status === "on_time") {
          statusBadge = `
            <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
              <i class="fa-solid fa-circle-check"></i>
              Tepat Waktu
            </span>
          `;
          fineInfo = `
            <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                  <i class="fa-solid fa-smile text-white text-lg"></i>
                </div>
                <div class="flex-1">
                  <p class="text-sm font-semibold text-green-700 mb-1">Tidak Ada Denda</p>
                  <p class="text-xs text-green-600">Buku masih dalam masa peminjaman. Kembalikan sebelum deadline!</p>
                </div>
              </div>
            </div>
          `;
        } else if (loan.fine_status === "overdue_pending") {
          statusBadge = `
            <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
              <i class="fa-solid fa-clock"></i>
              Terlambat
            </span>
          `;
          fineInfo = `
            <div class="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-4 border border-yellow-200">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-full bg-yellow-600 flex items-center justify-center flex-shrink-0">
                  <i class="fa-solid fa-exclamation-triangle text-white text-lg"></i>
                </div>
                <div class="flex-1">
                  <p class="text-sm font-semibold text-yellow-700 mb-2">Denda Sedang Dihitung</p>
                  <div class="bg-white rounded-lg p-3 mb-2">
                    <div class="flex items-center justify-between">
                      <span class="text-xs text-gray-600">Terlambat:</span>
                      <span class="font-bold text-gray-800">${loan.days_overdue} hari</span>
                    </div>
                    <div class="flex items-center justify-between mt-1">
                      <span class="text-xs text-gray-600">Denda/hari:</span>
                      <span class="font-bold text-gray-800">Rp ${loan.fine_per_day.toLocaleString('id-ID')}</span>
                    </div>
                    <div class="border-t my-2"></div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-semibold text-gray-800">Estimasi Denda:</span>
                      <span class="text-lg font-bold text-orange-600">~Rp ${loan.calculated_fine.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                  <div class="flex items-start gap-2 text-xs text-yellow-700 bg-yellow-100 rounded p-2">
                    <i class="fa-solid fa-star text-red-500 text-[10px] mt-0.5"></i>
                    <p>Tanggal denda dihitung sehari setelah deadline pengembalian buku, jika buku belum dikembalikan. Sistem akan menghitung denda secara otomatis berdasarkan hari kerja (tidak termasuk hari libur dan hari Minggu).</p>
                  </div>
                </div>
              </div>
            </div>
          `;
        } else if (loan.fine_status === "has_fine") {
          statusBadge = `
            <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              <i class="fa-solid fa-circle-exclamation"></i>
              Ada Denda
            </span>
          `;
          fineInfo = `
            <div class="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-4 border border-red-200">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                  <i class="fa-solid fa-triangle-exclamation text-white text-lg"></i>
                </div>
                <div class="flex-1">
                  <p class="text-sm font-semibold text-red-700 mb-2">Denda Aktif Tercatat</p>
                  <div class="bg-white rounded-lg p-3 mb-2">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-xs text-gray-600">Tanggal Denda:</span>
                      <span class="font-semibold text-gray-800">${formatDate(loan.fine_date)}</span>
                    </div>
                    <div class="flex items-center justify-between mt-1">
                      <span class="text-xs text-gray-600">Terlambat:</span>
                      <span class="font-bold text-gray-800">${loan.days_overdue} hari</span>
                    </div>
                    <div class="border-t my-2"></div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-semibold text-gray-800">Total Denda:</span>
                      <span class="text-lg font-bold text-red-600">Rp ${loan.calculated_fine.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                  <p class="text-xs text-red-600 bg-red-100 rounded p-2">
                    <i class="fa-solid fa-info-circle mr-1"></i>
                    Harap lunasi denda sebelum meminjam buku lain atau memperpanjang peminjaman
                  </p>
                </div>
              </div>
            </div>
          `;
        }
  
        card.innerHTML = `
          <div class="flex gap-4 mb-4">
            <img src="${loan.image || '/images/buku.png'}" 
                 alt="${loan.title}" 
                 class="w-16 h-24 object-cover rounded-lg shadow-md border border-gray-200 flex-shrink-0">
            
            <div class="flex-1">
              <h4 class="font-bold text-gray-800 text-sm mb-2 line-clamp-2">${loan.title}</h4>
              <div class="flex flex-wrap gap-2 mb-2">
                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                  <i class="fa-solid fa-barcode"></i>
                  ${loan.item_code}
                </span>
                ${statusBadge}
              </div>
              <div class="text-xs text-gray-600">
                <p><i class="fa-solid fa-calendar-check text-green-600 w-4"></i> Pinjam: ${formatDate(loan.loan_date)}</p>
                <p><i class="fa-solid fa-calendar-xmark text-red-600 w-4"></i> Deadline: ${formatDate(loan.due_date)}</p>
              </div>
            </div>
          </div>
  
          ${fineInfo}
        `;
  
        list.appendChild(card);
      });
  
      finesContainer.appendChild(list);
    }
  
    // =====================================================
    // 5️⃣ FUNGSI: Tampilkan Pesan Jika Tidak Ada Denda
    // =====================================================
    function showNoFinesMessage() {
      finesContainer.innerHTML = `
        <div class="bg-white rounded-2xl p-8 text-center border border-gray-200">
          <div class="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center">
            <i class="fa-solid fa-check-circle text-4xl text-green-600"></i>
          </div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">Tidak Ada Denda</h3>
          <p class="text-gray-600 text-sm">Anda tidak memiliki denda aktif. Pertahankan catatan peminjaman Anda!</p>
        </div>
      `;
    }
  
    // =====================================================
    // 6️⃣ HELPER: Format Tanggal
    // =====================================================
    function formatDate(dateString) {
      if (!dateString) return "—";
      return new Date(dateString).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
  
    // =====================================================
    // 7️⃣ TOGGLE INFO DENDA (Collapse/Expand)
    // =====================================================
    const fineToggleBtn = document.querySelector("#toggle-fine-info");
    const fineInfoSection = document.querySelector("#fine-info-section");
  
    if (fineToggleBtn && fineInfoSection) {
      fineToggleBtn.addEventListener("click", () => {
        fineInfoSection.classList.toggle("hidden");
        const icon = fineToggleBtn.querySelector("i");
        
        if (fineInfoSection.classList.contains("hidden")) {
          icon.classList.remove("fa-chevron-up");
          icon.classList.add("fa-chevron-down");
          fineToggleBtn.querySelector("span").textContent = "Tampilkan Info Denda";
        } else {
          icon.classList.remove("fa-chevron-down");
          icon.classList.add("fa-chevron-up");
          fineToggleBtn.querySelector("span").textContent = "Sembunyikan Info Denda";
        }
      });
    }
  
    // =====================================================
    // 8️⃣ ANIMASI ENTRANCE untuk Cards
    // =====================================================
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px",
    };
  
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animate-slideUp");
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);
  
    // Observe semua cards
    document.querySelectorAll(".fine-card").forEach((card) => {
      observer.observe(card);
    });
  
    // =====================================================
    // 9️⃣ KALKULASI REAL-TIME Denda (Optional)
    // =====================================================
    function calculateRealTimeFine(dueDate, finePerDay) {
      const today = new Date();
      const due = new Date(dueDate);
      const diffTime = today - due;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
      if (diffDays <= 0) {
        return {
          isOverdue: false,
          daysOverdue: 0,
          totalFine: 0,
        };
      }
  
      return {
        isOverdue: true,
        daysOverdue: diffDays,
        totalFine: diffDays * finePerDay,
      };
    }
  
    // =====================================================
    // 🔟 UPDATE TOTAL DENDA DISPLAY
    // =====================================================
    const totalFineDisplay = document.querySelector("#total-fine-display");
    const totalDendaInput = document.querySelector("#total-denda");
  
    if (totalFineDisplay && totalDendaInput) {
      const totalDenda = parseFloat(totalDendaInput.value || "0");
      
      totalFineDisplay.innerHTML = `
        <div class="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-6 border-2 border-red-200">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center">
                <i class="fa-solid fa-money-bill-wave text-white text-xl"></i>
              </div>
              <div>
                <p class="text-sm text-gray-600 mb-1">Total Denda Aktif</p>
                <p class="text-3xl font-bold text-red-600">
                  Rp ${totalDenda.toLocaleString("id-ID")}
                </p>
              </div>
            </div>
            ${
              totalDenda > 0
                ? `
            <div class="text-right">
              <span class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-red-600 text-white">
                <i class="fa-solid fa-exclamation-circle"></i>
                Perlu Dibayar
              </span>
            </div>
            `
                : `
            <div class="text-right">
              <span class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-green-600 text-white">
                <i class="fa-solid fa-check-circle"></i>
                Lunas
              </span>
            </div>
            `
            }
          </div>
          ${
            totalDenda > 0
              ? `
          <div class="mt-4 p-3 bg-white rounded-lg border border-red-200">
            <p class="text-xs text-red-700">
              <i class="fa-solid fa-info-circle mr-1"></i>
              Harap lunasi denda di perpustakaan sebelum meminjam buku lain atau memperpanjang peminjaman.
            </p>
          </div>
          `
              : ""
          }
        </div>
      `;
    }
  
    // =====================================================
    // 1️⃣1️⃣ PRINT RECEIPT DENDA
    // =====================================================
    const printBtn = document.querySelector("#print-fine-receipt");
    
    if (printBtn) {
      printBtn.addEventListener("click", () => {
        window.print();
      });
    }
  
    console.log("✅ Denda handler initialized successfully");
  });