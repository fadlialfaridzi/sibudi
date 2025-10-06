// =====================================================
// main.js — Script umum SiBuDi (frontend ringan)
// =====================================================
// Fungsionalitas:
// ✅ Toggle password (login page)
// ✅ Validasi input dasar (misal NIM, trim spasi otomatis)
// ✅ Popup handled by popup.js
// ✅ Halaman Perpanjangan (outside/perpanjangan.ejs)
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
  // 2️⃣ Validasi Input Dasar (misal: NIM, trim otomatis)
  // =====================================================
  const nimInput = document.querySelector("#nim");
  if (nimInput) {
    nimInput.addEventListener("blur", (e) => {
      e.target.value = e.target.value.trim();
    });
  }

  // =====================================================
  // 3️⃣ Halaman Perpanjangan (outside/perpanjangan.ejs)
  // =====================================================
  const loansDataEl = document.querySelector("#loans-data");
  const loanList = document.querySelector("#loan-list");
  const bookDetail = document.querySelector("#book-detail");
  const totalDenda = parseFloat(document.querySelector("#total-denda")?.value || "0");

  if (loansDataEl && loanList && bookDetail) {
    try {
      const loans = JSON.parse(loansDataEl.textContent || "[]");

      loanList.addEventListener("click", (e) => {
        const li = e.target.closest(".loan-item");
        if (!li) return;
        const idx = parseInt(li.dataset.index, 10);
        showDetail(idx);
      });

      // =====================================================
      // 🟢 Tampilkan Detail Buku
      // =====================================================
      function showDetail(index) {
        const b = loans[index];
        if (!b) return;
        bookDetail.innerHTML = "";

        // Thumbnail
        const img = document.createElement("img");
        img.src = b.image || "/images/buku.png";
        img.alt = b.title || "Buku";
        img.className = "w-24 h-24 object-cover rounded mb-3";

        const title = document.createElement("h2");
        title.className = "text-xl font-semibold text-green-700 mb-2";
        title.textContent = b.title || "—";

        const author = document.createElement("p");
        author.className = "text-gray-600 mb-1";
        author.innerHTML = `<strong>Penulis/Penerbit:</strong> ${b.author || "Tidak diketahui"}`;

        const year = document.createElement("p");
        year.className = "text-gray-600 mb-1";
        year.innerHTML = `<strong>Tahun Terbit:</strong> ${b.publish_year || "—"}`;

        const coll = document.createElement("p");
        coll.className = "text-gray-600 mb-1";
        coll.innerHTML = `<strong>Jumlah Halaman:</strong> ${b.collation || "—"}`;

        const lang = document.createElement("p");
        lang.className = "text-gray-600 mb-3";
        lang.innerHTML = `<strong>Bahasa:</strong> ${b.language_id || "—"}`;

        const overview = document.createElement("p");
        overview.className = "text-gray-600 mb-4";
        overview.innerHTML = `<strong>Project Overview:</strong> ${b.notes || "Tidak ada deskripsi"}`;

        const loanDate = document.createElement("p");
        loanDate.innerHTML = `<strong>Tanggal Peminjaman:</strong> ${
          b.loan_date ? new Date(b.loan_date).toLocaleDateString("id-ID") : "-"
        }`;

        const dueDate = document.createElement("p");
        dueDate.innerHTML = `<strong>Deadline Pengembalian:</strong> ${
          b.due_date ? new Date(b.due_date).toLocaleDateString("id-ID") : "-"
        }`;

        // =====================================================
        // 🔁 Tombol Perpanjangan Buku
        // =====================================================
        const extendContainer = document.createElement("div");
        extendContainer.className = "mt-5 border-t pt-4";

        const extendBtn = document.createElement("button");
        extendBtn.className =
          "bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition w-full sm:w-auto";
        extendBtn.innerHTML = `<i class="fa-solid fa-clock-rotate-left mr-2"></i>Perpanjang`;
        extendBtn.dataset.loanId = b.loan_id;

        // Kondisi disable
        let disabledReason = null;
        if (totalDenda > 0) disabledReason = "Anda memiliki denda aktif.";
        else if (b.renewed >= 2) disabledReason = "Anda sudah mencapai batas maksimal perpanjangan (2x).";

        if (disabledReason) {
          extendBtn.disabled = true;
          extendBtn.classList.add("opacity-60", "cursor-not-allowed");
        }

        extendBtn.addEventListener("click", () => handleExtend(b));

        extendContainer.appendChild(extendBtn);

        // =====================================================
        // ⚠️ Alert Kondisi
        // =====================================================
        if (disabledReason) {
          const warn = document.createElement("div");
          warn.className =
            "bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-lg p-4 mt-4 flex items-center justify-between";
          warn.innerHTML = `
            <div>
              <i class="fa-solid fa-exclamation mr-2"></i>
              ${disabledReason} <br/>
              <small class="text-sm">Silahkan konfirmasi ke pustakawan.</small>
            </div>
            <a href="/outside/denda" class="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold px-3 py-1 rounded">
              Cek Total Denda
            </a>`;
          extendContainer.prepend(warn);
        }

        // Render ke UI
        bookDetail.append(img, title, author, year, coll, lang, overview, loanDate, dueDate, extendContainer);
      }

      // =====================================================
      // 🔁 Fungsi Perpanjangan Buku (AJAX)
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

          const newDueDate = new Date(data.receipt.newDueDate).toLocaleDateString("id-ID");
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
      // 🔔 Helper showPopup (sinkron popup.js)
      // =====================================================
      function showPopup({ type = "info", title = "Info", message = "" }) {
        if (window.closePopup) window.closePopup();
        const popup = document.createElement("div");
        popup.id = "popup";
        popup.className =
          "fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-[1000] animate-fadeIn";
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
      }
    } catch (err) {
      console.error("❌ Gagal memuat data pinjaman:", err);
    }
  }
});
