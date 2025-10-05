// =====================================================
// main.js — Script umum SiBuDi (frontend ringan)
// =====================================================
// Fungsionalitas:
// ✅ Toggle password (login page)
// ✅ Validasi input dasar (misal NIM, trim spasi otomatis)
// ✅ (Popup & Toast sekarang ditangani oleh popup.js)
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
          author.className = "text-gray-600 mb-3";
          author.innerHTML = `<strong>Penulis:</strong> ${b.author || "Tidak diketahui"}`;
  
          const publisher = document.createElement("p");
          publisher.className = "text-gray-600 mb-3";
          publisher.innerHTML = `<strong>Penerbit:</strong> ${b.publisher || "Tidak diketahui"}`;
  
          const overview = document.createElement("p");
          overview.className = "text-gray-600 mb-4";
          overview.innerHTML = `<strong>Project Overview:</strong> ${b.notes || "Tidak ada deskripsi"}`;
  
          const hr = document.createElement("hr");
          hr.className = "my-4";
  
          const loanDate = document.createElement("p");
          loanDate.innerHTML = `<strong>Tanggal Peminjaman:</strong> ${
            b.loan_date ? new Date(b.loan_date).toLocaleDateString() : "-"
          }`;
  
          const dueDate = document.createElement("p");
          dueDate.innerHTML = `<strong>Deadline Pengembalian:</strong> ${
            b.due_date ? new Date(b.due_date).toLocaleDateString() : "-"
          }`;
  
          bookDetail.append(title, author, publisher, overview, hr, loanDate, dueDate);
        }
      } catch (err) {
        console.error("❌ Gagal memuat data pinjaman:", err);
      }
    }
  });
  