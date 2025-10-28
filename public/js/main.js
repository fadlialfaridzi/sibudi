// =====================================================
// main.js — Script Frontend SIBUDI (FINAL FIXED)
// =====================================================
// ✅ Fix: Semua bracket tertutup, tak ada syntax error
// ✅ Kompatibel dengan detailPinjam.ejs
// ✅ Tambahan safety check untuk null element
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
    const romanMap = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let total = 0;
    for (let i = 0; i < roman.length; i++) {
      const current = romanMap[roman[i]];
      const next = romanMap[roman[i + 1]];
      if (next && current < next) total -= current;
      else total += current;
    }
    return total;
  }

  // =====================================================
  // Helper: Mapping Bahasa
  // =====================================================
  function getLanguageName(code) {
    const languages = {
      id: "Indonesia",
      en: "English",
      db: "Umum",
      ind: "Indonesia",
      eng: "English",
    };
    return languages[code?.toLowerCase()] || code || "—";
  }

  // =====================================================
  // 4️⃣ Efek Tilt 3D untuk Cards
  // =====================================================
  document.querySelectorAll(".loan-item, .card-3d, .hero-tilt").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rotateX = ((y - rect.height / 2) / 25) * -1;
      const rotateY = (x - rect.width / 2) / 25;
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
  // 6️⃣ Dashboard → Transisi ke detailPinjam
  // =====================================================
  const dashboardCard = document.querySelector(".dashboard-card");
  const mainBookImage = document.querySelector("#main-book-image");
  if (dashboardCard && mainBookImage) {
    dashboardCard.addEventListener("click", (e) => {
      e.preventDefault();
      mainBookImage.style.transition =
        "all 0.7s cubic-bezier(0.25, 0.8, 0.25, 1)";
      mainBookImage.style.transform =
        "translateX(-300px) scale(0.9) rotate(-5deg)";
      mainBookImage.style.opacity = "0.4";
      setTimeout(() => (window.location.href = "/outside/detailPinjam"), 700);
    });
  }

  // =====================================================
  // 7️⃣ DetailPinjam Logic - START
  // =====================================================
  const loansDataEl = document.querySelector("#loans-data");
  const loanList = document.querySelector("#loan-list");
  const bookDetail = document.querySelector("#book-detail");
  const mainContainer = document.querySelector("#main-container");
  const totalDendaInput = document.querySelector("#total-denda");
  const totalDenda = totalDendaInput
    ? parseFloat(totalDendaInput.value || "0")
    : 0;

  if (loansDataEl && loanList && bookDetail) {
    try {
      const loans = JSON.parse(loansDataEl.textContent || "[]");
      console.log("📚 Loaded loans data:", loans);

      if (loans.length > 0) {
        setTimeout(() => {
          showDetail(0);
          if (mainContainer) {
            mainContainer.setAttribute("data-active", "true");
          }
        }, 300);
      }

      // Klik daftar pinjaman
      loanList.addEventListener("click", (e) => {
        const li = e.target.closest(".loan-item");
        if (!li) return;
        document
          .querySelectorAll(".loan-item")
          .forEach((item) => item.classList.remove("active"));
        li.classList.add("active");
        const idx = parseInt(li.dataset.index, 10);
        showDetail(idx);
        if (mainContainer) mainContainer.setAttribute("data-active", "true");
      });
      // =====================================================
      // 📖 FUNGSI: Tampilkan Detail Buku dengan Transisi 3D
      // =====================================================
      function showDetail(index) {
        const b = loans[index];
        if (!b) return;

        console.log("🔍 Showing detail for:", b.title);

        // ✨ Fade-out dulu
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

        // Setelah animasi selesai, update isi
        setTimeout(() => {
          // Update gambar hero
          if (heroImage) {
            heroImage.src = b.image || "/images/buku.png";
            heroImage.alt = b.title || "Buku";
            setTimeout(() => (heroImage.style.opacity = "1"), 100);
          }

          // Bersihkan dan isi ulang
          bookDetail.innerHTML = "";
          const container = document.createElement("div");
          container.className = "space-y-4 lg:space-y-6 opacity-0 translate-y-3";
          container.style.transition = "opacity 0.6s ease, transform 0.6s ease";

          // =====================================================
          // CARD 1: Informasi Buku
          // =====================================================
          const card1 = document.createElement("div");
          card1.className =
            "card-3d bg-white rounded-2xl p-6 border border-green-200 hover:border-green-300 shadow-md transition-all";
          card1.innerHTML = `
            <h3 class="text-xl font-bold text-[#2F7A33] mb-4 flex items-center gap-2">
              <div class="w-10 h-10 rounded-full bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
                <i class="fa-solid fa-book text-green-600"></i>
              </div>
              <span>Informasi Buku</span>
            </h3>
          `;

          const bookInfoItems = [
            { icon: "fa-user-pen", bg: "bg-green-100", color: "text-green-600", label: "Penulis", value: b.author },
            { icon: "fa-calendar", bg: "bg-blue-100", color: "text-blue-600", label: "Tahun Terbit", value: b.publish_year },
            { icon: "fa-layer-group", bg: "bg-purple-100", color: "text-purple-600", label: "Jumlah Halaman", value: b.pages },
            { icon: "fa-ruler", bg: "bg-yellow-100", color: "text-yellow-600", label: "Ketebalan Buku", value: b.size },
            { icon: "fa-language", bg: "bg-indigo-100", color: "text-indigo-600", label: "Bahasa", value: getLanguageName(b.language_id) },
          ].filter((i) => i.value && i.value.toString().trim() !== "");

          const infoGrid = document.createElement("div");
          infoGrid.className = "grid grid-cols-1 sm:grid-cols-2 gap-4";

          if (bookInfoItems.length) {
            bookInfoItems.forEach((item) => {
              infoGrid.innerHTML += `
                <div class="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-100">
                  <div class="w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0">
                    <i class="fa-solid ${item.icon} ${item.color}"></i>
                  </div>
                  <div class="flex-1">
                    <p class="text-xs text-gray-500 uppercase mb-0.5">${item.label}</p>
                    <p class="font-semibold text-gray-800 text-sm">${item.value}</p>
                  </div>
                </div>
              `;
            });
          } else {
            infoGrid.innerHTML = `<p class="text-gray-500 text-sm italic">Informasi detail buku tidak tersedia</p>`;
          }
          card1.appendChild(infoGrid);

          // =====================================================
          // CARD 2: Status Peminjaman
          // =====================================================
          const card2 = document.createElement("div");
          card2.className =
            "card-3d bg-white rounded-2xl p-6 border border-blue-200 hover:border-blue-300 shadow-md transition-all";
          card2.innerHTML = `
            <h3 class="text-xl font-bold text-[#2F7A33] mb-4 flex items-center gap-2">
              <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <i class="fa-solid fa-calendar-days text-blue-600"></i>
              </div>
              <span>Status Peminjaman</span>
            </h3>
          `;

          const statusGrid = document.createElement("div");
          statusGrid.className = "grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4";
          statusGrid.innerHTML = `
            <div class="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <div class="flex items-center gap-3 mb-2">
                <i class="fa-solid fa-calendar-check text-blue-600"></i>
                <p class="text-xs text-gray-600 uppercase font-medium">Tanggal Pinjam</p>
              </div>
              <p class="font-bold text-gray-800">${formatDate(b.loan_date)}</p>
            </div>
            <div class="p-4 rounded-xl bg-red-50 border border-red-100">
              <div class="flex items-center gap-3 mb-2">
                <i class="fa-solid fa-calendar-xmark text-red-600"></i>
                <p class="text-xs text-gray-600 uppercase font-medium">Deadline Pengembalian</p>
              </div>
              <p class="font-bold text-gray-800">${formatDate(b.due_date)}</p>
            </div>
          `;
          card2.appendChild(statusGrid);

          // Perpanjangan info
          if (!b.noReborrow) {
            const renew = document.createElement("div");
            renew.className =
              "p-4 rounded-xl bg-green-50 border border-green-200 flex items-center justify-between";
            renew.innerHTML = `
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center">
                  <i class="fa-solid fa-arrows-rotate"></i>
                </div>
                <div>
                  <p class="text-xs text-gray-600 mb-0.5">Perpanjangan</p>
                  <p class="text-lg font-bold ${
                    b.renewed >= b.reborrow_limit ? "text-red-600" : "text-green-600"
                  }">${b.renewed || 0} dari ${b.reborrow_limit || 2} kali</p>
                </div>
              </div>
              ${
                b.renewed >= b.reborrow_limit
                  ? `<span class="text-xs font-semibold text-red-600 bg-red-100 px-3 py-1 rounded-full">Maksimal</span>`
                  : ""
              }
            `;
            card2.appendChild(renew);
          }

          // =====================================================
          // CARD 3: Aturan Peminjaman
          // =====================================================
          const card3 = document.createElement("div");
          card3.className =
            "card-3d bg-white rounded-2xl p-6 border border-yellow-200 hover:border-yellow-300 shadow-md transition-all";
          card3.innerHTML = `
            <h3 class="text-xl font-bold text-[#2F7A33] mb-4 flex items-center gap-2">
              <div class="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <i class="fa-solid fa-info-circle text-yellow-600"></i>
              </div>
              <span>Aturan Peminjaman</span>
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mb-4">
              <div class="text-center p-3 bg-white rounded-lg border border-yellow-100">
                <p class="text-gray-600 mb-1 text-xs uppercase">Durasi Peminjaman</p>
                <p class="font-bold text-gray-800 text-lg">${b.loan_periode || 7} hari</p>
              </div>
              <div class="text-center p-3 bg-white rounded-lg border border-yellow-100">
                <p class="text-gray-600 mb-1 text-xs uppercase">Batas Perpanjangan</p>
                <p class="font-bold text-gray-800 text-lg">${b.reborrow_limit || 2} kali</p>
              </div>
              <div class="text-center p-3 bg-white rounded-lg border border-yellow-100">
                <p class="text-gray-600 mb-1 text-xs uppercase">Denda per Hari</p>
                <p class="font-bold text-gray-800 text-lg">Rp ${Number(
                  b.fine_per_day || 1000
                ).toLocaleString("id-ID")}</p>
              </div>
            </div>
            <div class="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
              <i class="fa-solid fa-asterisk text-red-600 text-xs mt-1 flex-shrink-0"></i>
              <p class="text-xs text-red-700 font-medium">
                Perhitungan denda dimulai sehari setelah deadline pengembalian
              </p>
            </div>
          `;

          // =====================================================
          // CARD 4: Denda
          // =====================================================
          let card4 = "";
          if (totalDenda > 0) {
            card4 = document.createElement("div");
            card4.className =
              "card-3d bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-6 border-2 border-red-300 shadow-lg";
            card4.innerHTML = `
              <h3 class="text-xl font-bold text-red-700 mb-4 flex items-center gap-2">
                <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <i class="fa-solid fa-exclamation-triangle text-red-600"></i>
                </div>
                <span>Informasi Denda</span>
              </h3>
              <div class="bg-white rounded-xl p-4 border border-red-200 mb-3">
                <p class="text-sm text-gray-600 mb-2">Total Denda Aktif</p>
                <p class="text-3xl font-bold text-red-600">Rp ${totalDenda.toLocaleString("id-ID")}</p>
              </div>
              <div class="p-4 bg-red-100 rounded-xl border border-red-300 text-sm text-red-700">
                <p class="font-semibold mb-1">Anda memiliki denda aktif!</p>
                <p>Harap lunasi sebelum melakukan perpanjangan atau peminjaman baru.</p>
              </div>
            `;
          }

          // =====================================================
          // CARD 5: Aksi Perpanjangan
          // =====================================================
          const card5 = document.createElement("div");
          card5.className =
            "card-3d bg-white rounded-2xl p-6 border border-gray-200 hover:border-green-300 shadow-md transition-all";
          card5.innerHTML = `
            <h3 class="text-xl font-bold text-[#2F7A33] mb-4 flex items-center gap-2">
              <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <i class="fa-solid fa-clock-rotate-left text-green-600"></i>
              </div>
              <span>Aksi Perpanjangan</span>
            </h3>
          `;
          // =============================
          // Logika tombol perpanjangan
          // =============================
          const actionDiv = document.createElement("div");
          let disabledReason = null;
          let warningType = "warning";

          if (b.noReborrow) {
            disabledReason = "Jenis koleksi ini tidak dapat diperpanjang sesuai kebijakan perpustakaan.";
            warningType = "info";
          } else if (totalDenda > 0) {
            disabledReason = `Anda memiliki denda aktif sebesar <b>Rp ${totalDenda.toLocaleString(
              "id-ID"
            )}</b>. Harap lunasi terlebih dahulu.`;
            warningType = "error";
          } else if (b.renewed >= b.reborrow_limit) {
            disabledReason = `Anda sudah mencapai batas maksimal perpanjangan (<b>${b.reborrow_limit}x</b>).`;
            warningType = "warning";
          }

          // Jika tidak bisa diperpanjang → tampilkan box warning
          if (disabledReason) {
            const warn = document.createElement("div");
            let bgColor, borderColor, iconColor, textColor, icon;

            if (warningType === "info") {
              bgColor = "from-gray-50 to-blue-50";
              borderColor = "border-gray-300";
              iconColor = "bg-gray-200 text-gray-600";
              textColor = "text-gray-700";
              icon = "fa-info-circle";
            } else if (warningType === "error") {
              bgColor = "from-red-50 to-orange-50";
              borderColor = "border-red-200";
              iconColor = "bg-red-100 text-red-600";
              textColor = "text-red-700";
              icon = "fa-exclamation-circle";
            } else {
              bgColor = "from-yellow-50 to-orange-50";
              borderColor = "border-orange-200";
              iconColor = "bg-orange-100 text-orange-600";
              textColor = "text-orange-700";
              icon = "fa-triangle-exclamation";
            }

            warn.className = `bg-gradient-to-br ${bgColor} ${textColor} border ${borderColor} rounded-xl p-4 mb-4`;
            warn.innerHTML = `
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-full ${iconColor} flex items-center justify-center">
                  <i class="fa-solid ${icon}"></i>
                </div>
                <div class="flex-1">
                  <p class="font-semibold mb-1">${disabledReason}</p>
                  <p class="text-xs opacity-80">
                    ${
                      b.noReborrow
                        ? "Silakan hubungi pustakawan untuk informasi lebih lanjut mengenai aturan koleksi ini."
                        : "Silakan konfirmasi ke pustakawan untuk informasi lebih lanjut."
                    }
                  </p>
                </div>
              </div>`;
            actionDiv.appendChild(warn);
          }

          // =============================
          // Form tombol perpanjangan
          // =============================
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
          extendBtn.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Perpanjang Buku Ini`;

          if (disabledReason) {
            extendBtn.disabled = true;
            extendBtn.classList.add("opacity-50", "cursor-not-allowed", "grayscale");
            extendBtn.classList.remove("hover:from-green-700", "hover:to-green-800");
          }

          form.appendChild(extendBtn);
          actionDiv.appendChild(form);
          card5.appendChild(actionDiv);

          // =====================================================
          // APPEND semua card ke container utama
          // =====================================================
          container.append(card1, card2, card3);
          if (card4) container.appendChild(card4);
          container.appendChild(card5);
          bookDetail.appendChild(container);

          // =====================================================
          // Fade-in animasi masuk
          // =====================================================
          setTimeout(() => {
            container.style.opacity = "1";
            container.style.transform = "translateY(0)";
          }, 50);
        }, 400); // delay fade-out
      }

      // =====================================================
      // Helper format tanggal
      // =====================================================
      function formatDate(dateString) {
        if (!dateString) return "—";
        return new Date(dateString).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      }
    } catch (err) {
      console.error("❌ Gagal memuat data pinjaman:", err);
    }
  }

  // =====================================================
  // 🎠 CAROUSEL NAVIGATION
  // =====================================================
  const carouselPrev = document.querySelector("#carousel-prev");
  const carouselNext = document.querySelector("#carousel-next");
  const loanCarousel = document.querySelector("#loan-carousel");

  if (carouselPrev && carouselNext && loanCarousel) {
    let currentScroll = 0;
    const scrollAmount = 150;

    carouselPrev.addEventListener("click", () => {
      currentScroll = Math.max(0, currentScroll - scrollAmount);
      loanCarousel.scrollTo({ top: currentScroll, behavior: "smooth" });
    });

    carouselNext.addEventListener("click", () => {
      const maxScroll = loanCarousel.scrollHeight - loanCarousel.clientHeight;
      currentScroll = Math.min(maxScroll, currentScroll + scrollAmount);
      loanCarousel.scrollTo({ top: currentScroll, behavior: "smooth" });
    });
  }
});
