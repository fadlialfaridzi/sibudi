// =====================================================
// main.js — Script Frontend SIBUDI
// UPDATED: Full integration dengan dashboard & perpanjangan
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ SiBuDi frontend aktif");

  // =====================================================
  // 1️⃣ Toggle Password (halaman login)
  // =====================================================
  const passwordInput = document.querySelector("#password");
  const toggleBtn = document.querySelector("#togglePassword");
  const eyeIcon = document.querySelector("#eyeIcon");

  if (passwordInput && toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const isHidden = passwordInput.type === "password";
      passwordInput.type = isHidden ? "text" : "password";

      if (eyeIcon) {
        eyeIcon.classList.toggle("fa-eye");
        eyeIcon.classList.toggle("fa-eye-slash");
      }
    });
  }

  // =====================================================
  // 2️⃣ Validasi Input Dasar (NIM, trim otomatis)
  // =====================================================
  const nimInput = document.querySelector("#nim");
  if (nimInput) {
    nimInput.addEventListener("blur", (e) => {
      e.target.value = e.target.value.trim();
    });
  }

  // =====================================================
  // 3️⃣ Helper: Konversi Angka Romawi ke Desimal
  // =====================================================
  function romanToDecimal(roman) {
    const romanMap = {
      I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000
    };
    const romanNumerals = {
      1: 'Satu', 2: 'Dua', 3: 'Tiga', 4: 'Empat', 5: 'Lima',
      6: 'Enam', 7: 'Tujuh', 8: 'Delapan', 9: 'Sembilan', 10: 'Sepuluh',
      11: 'Sebelas', 12: 'Dua Belas', 13: 'Tiga Belas', 14: 'Empat Belas', 15: 'Lima Belas',
      20: 'Dua Puluh', 24: 'Dua Puluh Empat', 30: 'Tiga Puluh', 50: 'Lima Puluh'
    };

    let total = 0;
    for (let i = 0; i < roman.length; i++) {
      const current = romanMap[roman[i]];
      const next = romanMap[roman[i + 1]];
      if (next && current < next) {
        total -= current;
      } else {
        total += current;
      }
    }
    return romanNumerals[total] || total.toString();
  }

  // =====================================================
  // Helper: Mapping Bahasa
  // =====================================================
  function getLanguageName(code) {
    const languages = {
      'id': 'Indonesia',
      'en': 'English',
      'db': 'Umum',
      'ind': 'Indonesia',
      'eng': 'English'
    };
    return languages[code?.toLowerCase()] || code || '—';
  }

  // =====================================================
  // 4️⃣ Efek Tilt 3D untuk Cards (Mouse Movement)
  // =====================================================
  document.querySelectorAll(".loan-item, .card-3d, .hero-tilt").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Hitung rotasi subtle
      const rotateX = ((y - centerY) / 25) * -1;
      const rotateY = (x - centerX) / 25;
      
      el.style.setProperty("--rotateX", `${rotateX}deg`);
      el.style.setProperty("--rotateY", `${rotateY}deg`);
    });

    el.addEventListener("mouseleave", () => {
      el.style.setProperty("--rotateX", "0deg");
      el.style.setProperty("--rotateY", "0deg");
    });
  });

  // =====================================================
  // 5️⃣ Responsive Font untuk Judul Buku di Mobile
  // =====================================================
  function adjustTitleFontSize() {
    if (window.innerWidth <= 768) {
      document.querySelectorAll(".title-responsive").forEach((title) => {
        const lineHeight = parseFloat(getComputedStyle(title).lineHeight);
        const maxHeight = lineHeight * 2;
        
        if (title.scrollHeight > maxHeight) {
          title.style.fontSize = "0.75rem";
        }
      });
    }
  }

  adjustTitleFontSize();
  window.addEventListener("resize", adjustTitleFontSize);

  // =====================================================
  // 6️⃣ DASHBOARD PAGE - Animasi Transisi ke Perpanjangan
  // =====================================================
  const dashboardCard = document.querySelector('.dashboard-card');
  const mainBookImage = document.querySelector('#main-book-image');
  
  if (dashboardCard && mainBookImage) {
    dashboardCard.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Animasi buku bergerak ke kiri dan redup
      mainBookImage.style.transition = 'all 0.7s cubic-bezier(0.25, 0.8, 0.25, 1)';
      mainBookImage.style.transform = 'translateX(-300px) scale(0.9) rotate(-5deg)';
      mainBookImage.style.opacity = '0.4';
      
      // Redirect setelah animasi
      setTimeout(() => {
        window.location.href = '/outside/perpanjangan';
      }, 700);
    });
  }

  // =====================================================
  // 7️⃣ PERPANJANGAN PAGE - Logika Utama
  // =====================================================
  const loansDataEl = document.querySelector("#loans-data");
  const loanList = document.querySelector("#loan-list");
  const bookDetail = document.querySelector("#book-detail");
  const bookInfo = document.querySelector("#book-info");
  const totalDendaInput = document.querySelector("#total-denda");
  const totalDenda = totalDendaInput ? parseFloat(totalDendaInput.value || "0") : 0;

  if (loansDataEl && loanList && bookDetail) {
    try {
      const loans = JSON.parse(loansDataEl.textContent || "[]");

      // Auto-load buku pertama saat halaman dibuka
      if (loans.length > 0) {
        setTimeout(() => {
          showDetail(0);
        }, 300);
      }

      // Handle click pada list item
      loanList.addEventListener("click", (e) => {
        const li = e.target.closest(".loan-item");
        if (!li) return;
        
        // Update active state
        document.querySelectorAll(".loan-item").forEach(item => {
          item.classList.remove("active");
        });
        li.classList.add("active");
        
        const idx = parseInt(li.dataset.index, 10);
        showDetail(idx);
      });

      // =====================================================
      // 📖 FUNGSI: Tampilkan Detail Buku
      // =====================================================
      function showDetail(index) {
        const b = loans[index];
        if (!b) return;
        
        // Update gambar buku utama dengan transisi smooth
        const mainBookImg = document.querySelector("#main-book-image");
        if (mainBookImg) {
          mainBookImg.style.opacity = "0";
          mainBookImg.style.transform = "scale(0.9)";
          
          setTimeout(() => {
            mainBookImg.src = b.image || "/images/buku1.png";
            mainBookImg.alt = b.title || "Buku";
            mainBookImg.style.transition = "all 0.5s ease-out";
            mainBookImg.style.opacity = "1";
            mainBookImg.style.transform = "scale(1)";
          }, 200);
        }
        
        // Clear dan rebuild detail panel
        bookDetail.innerHTML = "";

        const container = document.createElement("div");
        container.className = "space-y-4 lg:space-y-6";
        container.style.opacity = "0";
        container.style.transform = "translateY(20px)";

        // =====================================================
        // CARD 1: INFORMASI BUKU
        // =====================================================
        const card1 = createCard(
          "Informasi Buku",
          "fa-book",
          "green",
          () => {
            const infoGrid = document.createElement("div");
            infoGrid.className = "grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm";

            if (b.author) infoGrid.appendChild(createInfoItem("fa-user-pen", "Penulis/Penerbit", b.author));
            if (b.publish_year) infoGrid.appendChild(createInfoItem("fa-calendar", "Tahun Terbit", b.publish_year));
            if (b.edition) {
              const romanText = /^[IVXLCDM]+$/i.test(b.edition) 
                ? `${b.edition} (${romanToDecimal(b.edition)})` 
                : b.edition;
              infoGrid.appendChild(createInfoItem("fa-layer-group", "Edisi", romanText));
            }
            if (b.pages) infoGrid.appendChild(createInfoItem("fa-file-lines", "Jumlah Halaman", b.pages));
            if (b.size) infoGrid.appendChild(createInfoItem("fa-ruler", "Ketebalan Buku", b.size));
            if (b.language_id) infoGrid.appendChild(createInfoItem("fa-language", "Bahasa", getLanguageName(b.language_id)));

            return infoGrid;
          }
        );
        card1.insertBefore(createCardTitle(b.title, "fa-book", "green"), card1.firstChild);

        // =====================================================
        // CARD 2: STATUS PEMINJAMAN
        // =====================================================
        const card2 = createCard(
          "Status Peminjaman",
          "fa-calendar-days",
          "blue",
          () => {
            const statusGrid = document.createElement("div");
            statusGrid.className = "grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm";

            statusGrid.appendChild(createInfoItem(
              "fa-calendar-check",
              "Tanggal Pinjam",
              b.loan_date ? formatDate(b.loan_date) : "—"
            ));

            statusGrid.appendChild(createInfoItem(
              "fa-calendar-xmark",
              "Deadline Pengembalian",
              b.due_date ? formatDate(b.due_date) : "—"
            ));

            return statusGrid;
          }
        );

        // Badge perpanjangan
        const renewBadge = document.createElement("div");
        renewBadge.className = "mt-4 p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100 border border-green-200";
        renewBadge.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
                <i class="fa-solid fa-arrows-rotate text-white"></i>
              </div>
              <div>
                <p class="text-xs text-gray-600 mb-0.5">Perpanjangan</p>
                <p class="text-lg font-bold ${b.renewed >= 2 ? 'text-red-600' : 'text-green-600'}">
                  ${b.renewed || 0} dari 2 kali
                </p>
              </div>
            </div>
            ${b.renewed >= 2 ? '<span class="text-xs font-semibold text-red-600 bg-red-100 px-3 py-1 rounded-full">Maksimal</span>' : ''}
          </div>
        `;
        card2.appendChild(renewBadge);

        // =====================================================
        // CARD 3: AKSI PERPANJANGAN
        // =====================================================
        const card3 = createCard(
          "Aksi Perpanjangan",
          "fa-clock-rotate-left",
          "yellow",
          () => {
            const actionDiv = document.createElement("div");

            // Cek kondisi disable
            let disabledReason = null;
            if (totalDenda > 0) disabledReason = "Anda memiliki denda aktif.";
            else if (b.renewed >= 2) disabledReason = "Anda sudah mencapai batas maksimal perpanjangan (2x).";

            // Warning message
            if (disabledReason) {
              const warn = document.createElement("div");
              warn.className = "bg-gradient-to-br from-yellow-50 to-orange-50 text-orange-700 border border-orange-200 rounded-xl p-4 mb-4";
              warn.innerHTML = `
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <i class="fa-solid fa-triangle-exclamation text-orange-600"></i>
                  </div>
                  <div class="flex-1">
                    <p class="font-semibold mb-1">${disabledReason}</p>
                    <p class="text-xs text-orange-600">Silahkan konfirmasi ke pustakawan untuk informasi lebih lanjut.</p>
                  </div>
                </div>
              `;
              actionDiv.appendChild(warn);
            }

            // Tombol Perpanjang
            const extendBtn = document.createElement("button");
            extendBtn.className = "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 py-4 rounded-xl font-bold transition w-full shadow-lg flex items-center justify-center gap-2";
            extendBtn.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> Perpanjang Buku Ini';
            extendBtn.dataset.loanId = b.loan_id;

            if (disabledReason) {
              extendBtn.disabled = true;
              extendBtn.classList.add("opacity-40", "cursor-not-allowed");
              extendBtn.classList.remove("hover:from-green-700", "hover:to-green-800");
            }

            extendBtn.addEventListener("click", () => handleExtend(b));
            actionDiv.appendChild(extendBtn);

            return actionDiv;
          }
        );

        // Append semua cards
        container.append(card1, card2, card3);
        bookDetail.appendChild(container);

        // Trigger fade-in animation
        setTimeout(() => {
          container.style.transition = "all 0.6s ease-out";
          container.style.opacity = "1";
          container.style.transform = "translateY(0)";
        }, 50);
      }

      // =====================================================
      // 🛠️ HELPER FUNCTIONS
      // =====================================================
      
      // Format tanggal ke format Indonesia
      function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString("id-ID", {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      }

      // Buat card wrapper
      function createCard(title, icon, color, contentFunc) {
        const card = document.createElement("div");
        card.className = `card-3d bg-white rounded-2xl p-6 border border-gray-200 hover:border-${color}-300 transition-all`;
        
        const cardTitle = document.createElement("h3");
        cardTitle.className = "text-lg font-bold text-gray-800 mb-4 flex items-center gap-2";
        cardTitle.innerHTML = `
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-${color}-50 to-${color}-100 flex items-center justify-center">
            <i class="fa-solid ${icon} text-${color}-600"></i>
          </div>
          <span>${title}</span>
        `;
        card.appendChild(cardTitle);
        
        const content = contentFunc();
        if (content) card.appendChild(content);
        
        return card;
      }

      // Buat card title dengan judul buku
      function createCardTitle(title, icon, color) {
        const titleEl = document.createElement("h3");
        titleEl.className = "text-xl font-bold text-gray-800 mb-4 flex items-center gap-2";
        titleEl.innerHTML = `
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-${color}-50 to-${color}-100 flex items-center justify-center">
            <i class="fa-solid ${icon} text-${color}-600"></i>
          </div>
          <span class="line-clamp-2">${title || "—"}</span>
        `;
        return titleEl;
      }

      // Buat info item
      function createInfoItem(icon, label, value) {
        const item = document.createElement("div");
        item.className = "flex items-start gap-3 p-3 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-100";
        item.innerHTML = `
          <div class="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
            <i class="fa-solid ${icon} text-green-600 text-sm"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-gray-500 mb-0.5">${label}</p>
            <p class="font-semibold text-gray-800 truncate">${value}</p>
          </div>
        `;
        return item;
      }

      // =====================================================
      // 📤 FUNGSI: Perpanjangan Buku (AJAX)
      // =====================================================
      async function handleExtend(loan) {
        try {
          const res = await fetch("/outside/extend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ loan_id: loan.loan_id }),
          });

          const data = await res.json();

          if (!data.success) {
            showPopup({
              type: data.type || "warning",
              title: "Gagal Memperpanjang",
              message: data.message || "Tidak dapat memperpanjang pinjaman.",
            });
            return;
          }

          const newDueDate = formatDate(data.receipt.newDueDate);
          
          showPopup({
            type: "success",
            title: "Perpanjangan Berhasil",
            message: `Buku <strong>${loan.title}</strong> berhasil diperpanjang hingga <strong>${newDueDate}</strong>.`,
          });

          setTimeout(() => location.reload(), 2500);
        } catch (err) {
          console.error("❌ Gagal melakukan perpanjangan:", err);
          showPopup({
            type: "error",
            title: "Kesalahan Koneksi",
            message: "Terjadi kesalahan saat menghubungi server.",
          });
        }
      }

      // =====================================================
      // 💬 FUNGSI: Show Popup
      // =====================================================
      function showPopup({ type = "info", title = "Info", message = "" }) {
        // Hapus popup lama jika ada
        const oldPopup = document.querySelector("#popup");
        if (oldPopup) oldPopup.remove();

        const popup = document.createElement("div");
        popup.id = "popup";
        popup.className = "fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-[1000] animate-fadeIn";
        popup.innerHTML = `
          <div class="bg-white rounded-2xl shadow-2xl w-[90%] max-w-md p-6 text-center relative">
            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
              type === "success"
                ? "bg-green-100"
                : type === "error"
                ? "bg-red-100"
                : type === "warning"
                ? "bg-yellow-100"
                : "bg-blue-100"
            }">
              <i class="fa-solid ${
                type === "success"
                  ? "fa-check text-green-600"
                  : type === "error"
                  ? "fa-xmark text-red-600"
                  : type === "warning"
                  ? "fa-exclamation text-yellow-600"
                  : "fa-info text-blue-600"
              } text-3xl"></i>
            </div>
            <h2 class="text-lg font-semibold text-gray-800 mb-2">${title}</h2>
            <p class="text-gray-600 mb-6">${message}</p>
            <button type="button" data-popup-close
              class="popup-close w-full rounded-full bg-green-700 text-white font-semibold py-3 hover:bg-green-800 transition active:scale-[0.97]">
              OK
            </button>
          </div>`;
        document.body.appendChild(popup);
        
        // Attach close handler
        const closeBtn = popup.querySelector("[data-popup-close]");
        if (closeBtn) {
          closeBtn.addEventListener("click", () => {
            popup.remove();
          });
        }
      }

    } catch (err) {
      console.error("❌ Gagal memuat data pinjaman:", err);
    }
  }
});