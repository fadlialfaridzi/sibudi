// =====================================================
// main.js — Script Frontend SIBUDI
// UPDATED: Full integration dengan detailPinjam (transisi 3D interaktif)
// + Support untuk noReborrow flag
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
  // 6️⃣ DASHBOARD PAGE - Animasi Transisi ke detailPinjam
  // =====================================================
  const dashboardCard = document.querySelector('.dashboard-card');
  const mainBookImage = document.querySelector('#main-book-image');
  
  if (dashboardCard && mainBookImage) {
    dashboardCard.addEventListener('click', (e) => {
      e.preventDefault();
      
      mainBookImage.style.transition = 'all 0.7s cubic-bezier(0.25, 0.8, 0.25, 1)';
      mainBookImage.style.transform = 'translateX(-300px) scale(0.9) rotate(-5deg)';
      mainBookImage.style.opacity = '0.4';
      
      setTimeout(() => {
        window.location.href = '/outside/detailPinjam';
      }, 700);
    });
  }

  // =====================================================
  // 7️⃣ DETAIL PINJAM PAGE - Logika Utama dengan Transisi 3D
  // =====================================================
  const loansDataEl = document.querySelector("#loans-data");
  const loanList = document.querySelector("#loan-list");
  const bookDetail = document.querySelector("#book-detail");
  const mainContainer = document.querySelector("#main-container");
  const totalDendaInput = document.querySelector("#total-denda");
  const totalDenda = totalDendaInput ? parseFloat(totalDendaInput.value || "0") : 0;

  if (loansDataEl && loanList && bookDetail) {
    try {
      const loans = JSON.parse(loansDataEl.textContent || "[]");
      console.log("📚 Loaded loans data:", loans);

      // Auto-load buku pertama saat halaman dibuka dengan delay untuk smooth entry
      if (loans.length > 0) {
        setTimeout(() => {
          showDetail(0);
          // Aktifkan state transisi 3D
          if (mainContainer) {
            mainContainer.setAttribute('data-active', 'true');
          }
        }, 500);
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
        
        // Pastikan state transisi tetap aktif
        if (mainContainer) {
          mainContainer.setAttribute('data-active', 'true');
        }
      });

      // =====================================================
      // 📖 FUNGSI: Tampilkan Detail Buku dengan Transisi 3D
      // =====================================================
      function showDetail(index) {
        const b = loans[index];
        if (!b) return;
      
        console.log("🔍 Showing detail for book:", b.title);
        console.log("   - noReborrow:", b.noReborrow);
        console.log("   - renewed:", b.renewed);
        console.log("   - reborrow_limit:", b.reborrow_limit);
      
        // =====================================================
        // ✨ STEP 1: Fade-out detail lama sebelum ganti data
        // =====================================================
        const currentContent = bookDetail.querySelector("div");
        const heroImage = document.querySelector("#hero-image");
      
        if (currentContent) {
          currentContent.style.transition = "opacity 0.4s ease, transform 0.4s ease";
          currentContent.style.opacity = "0";
          currentContent.style.transform = "translateY(10px)";
        }
      
        if (heroImage) {
          heroImage.style.transition = "opacity 0.3s ease";
          heroImage.style.opacity = "0";
        }
      
        // Tunggu animasi fade-out selesai dulu
        setTimeout(() => {
          // =====================================================
          // STEP 2: Update Hero Image (Crossfade)
          // =====================================================
          if (heroImage) {
            heroImage.src = b.image || "/images/buku.png";
            heroImage.alt = b.title || "Buku";
            setTimeout(() => {
              heroImage.style.opacity = "1";
            }, 100);
          }
      
          // =====================================================
          // STEP 3: Ganti isi detail dengan konten baru (fade-in)
          // =====================================================
          bookDetail.innerHTML = "";
          const container = document.createElement("div");
          container.className = "space-y-4 lg:space-y-6 opacity-0 translate-y-3";
          container.style.transition = "opacity 0.6s ease, transform 0.6s ease";
      
          // CARD 1: Informasi Buku
          const card1 = createCard("Informasi Buku", "fa-book", "green", () => {
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
            if (b.language_id)
              infoGrid.appendChild(createInfoItem("fa-language", "Bahasa", getLanguageName(b.language_id)));
            return infoGrid;
          });
          card1.insertBefore(createCardTitle(b.title, "fa-book", "green"), card1.firstChild);
      
          // CARD 2: Status Peminjaman
          const card2 = createCard("Status Peminjaman", "fa-calendar-days", "blue", () => {
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
          });
      
          // Badge perpanjangan (hanya jika BUKAN noReborrow)
          if (!b.noReborrow) {
            const renewBadge = document.createElement("div");
            renewBadge.className =
              "mt-4 p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100 border border-green-200";
            renewBadge.innerHTML = `
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
                    <i class="fa-solid fa-arrows-rotate text-white"></i>
                  </div>
                  <div>
                    <p class="text-xs text-gray-600 mb-0.5">Perpanjangan</p>
                    <p class="text-lg font-bold ${b.renewed >= b.reborrow_limit ? "text-red-600" : "text-green-600"}">
                      ${b.renewed || 0} dari ${b.reborrow_limit || 2} kali
                    </p>
                  </div>
                </div>
                ${
                  b.renewed >= b.reborrow_limit
                    ? '<span class="text-xs font-semibold text-red-600 bg-red-100 px-3 py-1 rounded-full">Maksimal</span>'
                    : ""
                }
              </div>`;
            card2.appendChild(renewBadge);
          }
      
          // CARD 3: Aksi Perpanjangan
          const card3 = createCard("Aksi Perpanjangan", "fa-clock-rotate-left", "yellow", () => {
            const actionDiv = document.createElement("div");
            let disabledReason = null;
            let warningType = 'warning'; // 'warning', 'error', atau 'info'
            
            // ✅ PRIORITAS 1: Cek noReborrow (tidak bisa diperpanjang sama sekali)
            if (b.noReborrow) {
              disabledReason = "Jenis koleksi ini tidak dapat diperpanjang sesuai kebijakan perpustakaan.";
              warningType = 'info';
              console.log("⛔ Book cannot be renewed: noReborrow = true");
            } 
            // ✅ PRIORITAS 2: Cek denda aktif (baca langsung dari database via totalDenda)
            else if (totalDenda > 0) {
              disabledReason = `Anda memiliki denda aktif sebesar <b>Rp ${totalDenda.toLocaleString("id-ID")}</b>. Harap lunasi terlebih dahulu.`;
              warningType = 'error';
              console.log("💰 Cannot renew: has active fines of Rp", totalDenda);
            } 
            // ✅ PRIORITAS 3: Cek batas perpanjangan
            else if (b.renewed >= b.reborrow_limit) {
              disabledReason = `Anda sudah mencapai batas maksimal perpanjangan (<b>${b.reborrow_limit}x</b>).`;
              warningType = 'warning';
              console.log("🔄 Cannot renew: reached max limit", b.renewed, "/", b.reborrow_limit);
            }
      
            // Jika ada alasan disabled, tampilkan warning box
            if (disabledReason) {
              const warn = document.createElement("div");
              
              // Styling berdasarkan tipe warning
              let bgColor, borderColor, iconColor, textColor, icon;
              
              if (warningType === 'info') {
                // Info (noReborrow) - Abu-abu/Biru muda
                bgColor = "from-gray-50 to-blue-50";
                borderColor = "border-gray-300";
                iconColor = "bg-gray-200 text-gray-600";
                textColor = "text-gray-700";
                icon = "fa-info-circle";
              } else if (warningType === 'error') {
                // Error (denda) - Merah
                bgColor = "from-red-50 to-orange-50";
                borderColor = "border-red-200";
                iconColor = "bg-red-100 text-red-600";
                textColor = "text-red-700";
                icon = "fa-exclamation-circle";
              } else {
                // Warning (batas tercapai) - Kuning/Orange
                bgColor = "from-yellow-50 to-orange-50";
                borderColor = "border-orange-200";
                iconColor = "bg-orange-100 text-orange-600";
                textColor = "text-orange-700";
                icon = "fa-triangle-exclamation";
              }
              
              warn.className = `bg-gradient-to-br ${bgColor} ${textColor} border ${borderColor} rounded-xl p-4 mb-4`;
              warn.innerHTML = `
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-full ${iconColor} flex items-center justify-center flex-shrink-0">
                    <i class="fa-solid ${icon}"></i>
                  </div>
                  <div class="flex-1">
                    <p class="font-semibold mb-1">${disabledReason}</p>
                    <p class="text-xs opacity-80">
                      ${b.noReborrow 
                        ? 'Silakan hubungi pustakawan untuk informasi lebih lanjut mengenai aturan koleksi ini.' 
                        : 'Silakan konfirmasi ke pustakawan untuk informasi lebih lanjut.'}
                    </p>
                  </div>
                </div>`;
              actionDiv.appendChild(warn);
            }
      
            // Form perpanjangan
            const form = document.createElement("form");
            form.method = "POST";
            form.action = "/outside/extend";
            form.className = "w-full";
      
            const hiddenInput = document.createElement("input");
            hiddenInput.type = "hidden";
            hiddenInput.name = "loan_id";
            hiddenInput.value = b.loan_id;
            form.appendChild(hiddenInput);
      
            const extendBtn = document.createElement("button");
            extendBtn.type = "submit";
            extendBtn.className =
              "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 py-4 rounded-xl font-bold transition w-full shadow-lg flex items-center justify-center gap-2";
            extendBtn.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> Perpanjang Buku Ini';
      
            // Disable button jika ada alasan
            if (disabledReason) {
              extendBtn.disabled = true;
              extendBtn.classList.add("opacity-50", "cursor-not-allowed", "grayscale");
              extendBtn.classList.remove("hover:from-green-700", "hover:to-green-800");
              console.log("🚫 Button disabled");
            } else {
              console.log("✅ Button enabled");
            }
      
            form.appendChild(extendBtn);
            actionDiv.appendChild(form);
            return actionDiv;
          });
      
          // Append semua cards ke kontainer baru
          container.append(card1, card2, card3);
          bookDetail.appendChild(container);
      
          // =====================================================
          // STEP 4: Fade-in animasi masuk
          // =====================================================
          setTimeout(() => {
            container.style.opacity = "1";
            container.style.transform = "translateY(0)";
          }, 50);
        }, 300); // delay sama dengan durasi fade-out
      }
      

      // =====================================================
      // 🛠️ HELPER FUNCTIONS
      // =====================================================
      
      function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString("id-ID", {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }

      function createCard(title, icon, color, contentFunc) {
        const card = document.createElement("div");
        card.className = `card-3d bg-white rounded-2xl p-6 border border-gray-200 hover:border-${color}-300 transition-all shadow-md`;
        
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

    } catch (err) {
      console.error("❌ Gagal memuat data pinjaman:", err);
    }
  }

  // =====================================================
  // 8️⃣ CAROUSEL NAVIGATION (Opsional jika > 3 buku)
  // =====================================================
  const carouselPrev = document.querySelector("#carousel-prev");
  const carouselNext = document.querySelector("#carousel-next");
  const loanCarousel = document.querySelector("#loan-carousel");
  
  if (carouselPrev && carouselNext && loanCarousel) {
    let currentScroll = 0;
    const scrollAmount = 150;
    
    carouselPrev.addEventListener("click", () => {
      currentScroll = Math.max(0, currentScroll - scrollAmount);
      loanCarousel.scrollTo({
        top: currentScroll,
        behavior: 'smooth'
      });
    });
    
    carouselNext.addEventListener("click", () => {
      const maxScroll = loanCarousel.scrollHeight - loanCarousel.clientHeight;
      currentScroll = Math.min(maxScroll, currentScroll + scrollAmount);
      loanCarousel.scrollTo({
        top: currentScroll,
        behavior: 'smooth'
      });
    });
  }
});