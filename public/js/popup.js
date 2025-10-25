// public/js/popup.js
(function () {
  // Helper untuk menghapus elemen popup yang ditemukan
  function removeElement(el) {
    if (!el) return;
    try {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.35s ease';
      setTimeout(() => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }, 360);
    } catch (err) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
  }

  // Fade-out generic: mencari dua tipe popup yg mungkin ada
  function fadeOutPopup() {
    const toast = document.getElementById('popup-alert');
    const modal = document.getElementById('popup');
    if (toast) return removeElement(toast);
    if (modal) return removeElement(modal);
  }

  // Expose fallback global (agar onclick="closePopup()" aman)
  window.closePopup = fadeOutPopup;

  // =====================================================
  // 🆕 FUNCTION: showPopup (Client-Side Dynamic Popup)
  // =====================================================
  /**
   * Menampilkan popup dinamis dari JavaScript
   * @param {Object} options - { type, title, message }
   * @param {string} options.type - success | error | warning | info
   * @param {string} options.title - Judul popup
   * @param {string} options.message - Pesan popup (bisa HTML)
   */
  window.showPopup = function(options) {
    const { type = 'info', title = '', message = '' } = options;

    // Icon mapping
    const icons = {
      success: 'fa-check',
      error: 'fa-xmark',
      warning: 'fa-exclamation',
      info: 'fa-info'
    };

    const bgColors = {
      success: 'bg-green-100',
      error: 'bg-red-100',
      warning: 'bg-yellow-100',
      info: 'bg-blue-100'
    };

    const textColors = {
      success: 'text-green-600',
      error: 'text-red-600',
      warning: 'text-yellow-600',
      info: 'text-blue-600'
    };

    // Default title
    const defaultTitles = {
      success: 'Berhasil',
      error: 'Gagal',
      warning: 'Peringatan',
      info: 'Informasi'
    };

    const finalTitle = title || defaultTitles[type] || 'Notifikasi';

    // Create popup element
    const popupHTML = `
      <div
        id="popup"
        class="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-[1000] animate-fadeIn"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-[90%] max-w-md p-6 text-center relative">
          <!-- Icon -->
          <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${bgColors[type]}">
            <i class="fa-solid ${icons[type]} ${textColors[type]} text-3xl"></i>
          </div>

          <!-- Message -->
          <h2 class="text-lg font-semibold text-gray-800 mb-2">${finalTitle}</h2>
          <p class="text-gray-600 mb-6">${message}</p>

          <!-- Tombol -->
          <button
            type="button"
            onclick="window.closePopup()"
            class="popup-close w-full rounded-full bg-green-700 text-white font-semibold py-3 hover:bg-green-800 transition active:scale-[0.97]"
          >
            OK
          </button>
        </div>
      </div>

      <style>
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      </style>
    `;

    // Remove existing popup if any
    const existingPopup = document.getElementById('popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    // Insert popup to body
    document.body.insertAdjacentHTML('beforeend', popupHTML);

    // Auto-attach event listener to close button
    const newPopup = document.getElementById('popup');
    const closeBtn = newPopup.querySelector('.popup-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        removeElement(newPopup);
      });
    }

    // Close on overlay click
    newPopup.addEventListener('click', (e) => {
      if (e.target === newPopup) {
        removeElement(newPopup);
      }
    });
  };

  // Setup event listeners jika markup ada
  function setupPopup() {
    // 1) Toast style (popup-alert)
    const toast = document.getElementById('popup-alert');
    if (toast) {
      const closeBtn = toast.querySelector('#close-popup-btn');
      let timer = setTimeout(removeElement.bind(null, toast), 4000);

      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          clearTimeout(timer);
          removeElement(toast);
        });
      }

      // Klik di area toast juga akan menutupnya
      toast.addEventListener('click', () => {
        clearTimeout(timer);
        removeElement(toast);
      });
    }

    // 2) Modal overlay style (popup)
    const modal = document.getElementById('popup');
    if (modal) {
      // cari tombol dalam modal yang close (OK, Cancel, dsb.)
      const closeButtons = modal.querySelectorAll('[data-popup-close], .popup-close, button[type="button"].popup-ok, .btn-popup-close');
      
      if (closeButtons && closeButtons.length) {
        closeButtons.forEach((btn) =>
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeElement(modal);
          })
        );
      }

      // Tutup kalau klik area overlay di luar konten (opsional)
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          removeElement(modal);
        }
      });
    }
  }

  // Run setup saat DOM ready (robust)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPopup);
  } else {
    setupPopup();
  }
})();