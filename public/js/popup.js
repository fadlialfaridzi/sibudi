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
        // fallback: tombol dengan text "OK" (hati-hati)
        const fallbackBtn = modal.querySelector('button');
  
        // set auto close for modal? biasanya modal tidak auto-close; kita tidak auto-close modal kecuali ingin
        // jika ingin auto close, uncomment next line:
        // let timer2 = setTimeout(() => removeElement(modal), 4000);
  
        if (closeButtons && closeButtons.length) {
          closeButtons.forEach((btn) =>
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              removeElement(modal);
            })
          );
        } else if (fallbackBtn) {
          // jika tidak ada attribute khusus, pasang handler pada fallbackBtn (mis: OK button)
          fallbackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            removeElement(modal);
          });
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
  