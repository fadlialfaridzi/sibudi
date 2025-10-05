// =====================================================
// main.js — Script umum SiBuDi (frontend ringan)
// =====================================================
// Fungsionalitas:
// ✅ Toggle password (login page)
// ✅ Validasi input dasar (misal NIM, trim spasi otomatis)
// ✅ (Popup & Toast sekarang ditangani oleh popup.js)
// ✅ Interaksi halaman detailPinjam: pilih buku, tampil detail, perpanjangan pinjaman
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
  // 3️⃣ Halaman Detail Pinjam (outside/detailPinjam.ejs)
  // =====================================================
  const loansDataEl = document.querySelector("#loans-data");
  const loanList = document.querySelector("#loan-list");
  const bookDetail = document.querySelector("#book-detail");

  if (loansDataEl && loanList && bookDetail) {
    try {
      const loans = JSON.parse(loansDataEl.textContent || "[]");

      loanList.addEventListener("click", (e) => {
        const li = e.target.closest(".loan-item");
        if (!li) return;
        const idx = parseInt(li.dataset.index, 10);
        showDetail(idx);
      });

      function showDetail(index) {
        const b = loans[index];
        if (!b) return;

        bookDetail.innerHTML = "";

        const title = document.createElement("h2");
        title.className = "text-xl font-semibold text-green-700 mb-2";
        title.textContent = b.title || "—";

        const author = document.createElement("p");
        author.className = "text-gray-600 mb-1";
        author.innerHTML = `<strong>Penulis:</strong> ${b.author || "Tidak diketahui"}`;

        const publisher = document.createElement("p");
        publisher.className = "text-gray-600 mb-1";
        publisher.innerHTML = `<strong>Penerbit:</strong> ${b.publisher || "Tidak diketahui"}`;

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

        const extendContainer = document.createElement("div");
        extendContainer.className = "mt-5 border-t pt-4";

        const extendBtn = document.createElement("button");
        extendBtn.className =
          "bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition";
        extendBtn.innerHTML = `<i class="fa-solid fa-clock-rotate-left mr-2"></i>Perpanjang`;
        extendBtn.dataset.loanId = b.loan_id;

        extendBtn.addEventListener("click", () => handleExtend(b));

        extendContainer.appendChild(extendBtn);
        bookDetail.append(title, author, publisher, overview, loanDate, dueDate, extendContainer);
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

          // Jika gagal
          if (!data.success) {
            showPopup({
              type: data.type || "warning",
              title: "Gagal Memperpanjang",
              message: data.message || "Tidak dapat memperpanjang pinjaman.",
            });
            return;
          }

          // Jika sukses
          const newDueDate = new Date(data.receipt.newDueDate).toLocaleDateString("id-ID");
          showPopup({
            type: "success",
            title: "Perpanjangan Berhasil",
            message: `Buku <strong>${loan.title}</strong> berhasil diperpanjang hingga <strong>${newDueDate}</strong>.`,
          });

          setTimeout(() => location.reload(), 3000);
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
      // 🔔 Helper: showPopup (sinkron dengan popup.js)
      // =====================================================
      function showPopup({ type = "info", title = "Info", message = "" }) {
        const existing = document.getElementById("popup");
        if (existing) existing.remove();

        const wrapper = document.createElement("div");
        wrapper.innerHTML = `
          <div id="popup" class="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-[1000] animate-fadeIn">
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
            </div>
          </div>`;
        document.body.appendChild(wrapper);
        if (window.closePopup) window.closePopup();
      }
    } catch (err) {
      console.error("❌ Gagal memuat data pinjaman:", err);
    }
  }
});
