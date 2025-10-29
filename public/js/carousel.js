// public/js/carousel.js
document.addEventListener('DOMContentLoaded', function() {
    const carouselItems = document.querySelectorAll('.carousel-3d-item');
    const prevBtn = document.getElementById('carousel-prev-3d');
    const nextBtn = document.getElementById('carousel-next-3d');
    const indicators = document.querySelectorAll('.indicator');
    const loansDataEl = document.getElementById('loans-data');
    let currentIndex = 0;
    let loans = [];
  
    // Parse loans data
    if (loansDataEl) {
      try {
        loans = JSON.parse(loansDataEl.textContent);
        console.log('📚 Carousel.js: Loaded', loans.length, 'loans');
      } catch (err) {
        console.error('❌ Carousel.js: Error parsing loans data:', err);
      }
    }
  
    function updateCarousel(newIndex) {
      if (newIndex < 0 || newIndex >= carouselItems.length) return;
      
      console.log('🎠 Carousel updating to index:', newIndex);
      
      // Remove active class
      carouselItems.forEach(item => item.classList.remove('active'));
      indicators.forEach(ind => ind.classList.remove('active'));
      
      // Update positions with 3D transforms
      carouselItems.forEach((item, index) => {
        const diff = index - newIndex;
        let transform = '';
        let opacity = 1;
        let zIndex = 1;
        
        if (diff === 0) {
          transform = 'translate(-50%, -50%) translateX(0) rotateY(0deg) scale(1)';
          opacity = 1;
          zIndex = 10;
          item.classList.add('active');
        } else if (diff === -1) {
          transform = 'translate(-50%, -50%) translateX(-200px) rotateY(15deg) scale(0.92)';
          opacity = 0.8;
          zIndex = 2;
        } else if (diff === -2) {
          transform = 'translate(-50%, -50%) translateX(-400px) rotateY(25deg) scale(0.85)';
          opacity = 0.6;
          zIndex = 1;
        } else if (diff === 1) {
          transform = 'translate(-50%, -50%) translateX(200px) rotateY(-15deg) scale(0.92)';
          opacity = 0.8;
          zIndex = 2;
        } else if (diff === 2) {
          transform = 'translate(-50%, -50%) translateX(400px) rotateY(-25deg) scale(0.85)';
          opacity = 0.6;
          zIndex = 1;
        } else if (diff < -2) {
          transform = 'translate(-50%, -50%) translateX(-600px) rotateY(35deg) scale(0.7)';
          opacity = 0;
          zIndex = 0;
        } else {
          transform = 'translate(-50%, -50%) translateX(600px) rotateY(-35deg) scale(0.7)';
          opacity = 0;
          zIndex = 0;
        }
        
        item.style.transform = transform;
        item.style.opacity = opacity;
        item.style.zIndex = zIndex;
        item.style.pointerEvents = (diff === 0) ? 'auto' : 'none';
      });
      
      // Update active indicator
      if (indicators[newIndex]) {
        indicators[newIndex].classList.add('active');
      }
      
      currentIndex = newIndex;
      
      // ✅ PERBAIKAN: Panggil selectBook dari detailPinjam.ejs
      if (typeof window.selectBook === 'function') {
        console.log('✅ Calling selectBook from carousel.js');
        window.selectBook(newIndex);
      } else if (typeof window.showDetail === 'function') {
        console.log('✅ Calling showDetail (fallback) from carousel.js');
        window.showDetail(newIndex);
      } else {
        console.warn('⚠️ No selectBook or showDetail function found!');
      }
    }
  
    // Previous button
    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        const newIndex = currentIndex > 0 ? currentIndex - 1 : carouselItems.length - 1;
        updateCarousel(newIndex);
      });
    }
  
    // Next button
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        const newIndex = currentIndex < carouselItems.length - 1 ? currentIndex + 1 : 0;
        updateCarousel(newIndex);
      });
    }
  
    // Indicator click
    indicators.forEach((indicator, index) => {
      indicator.addEventListener('click', function() {
        updateCarousel(index);
      });
    });
  
    // Carousel item click sudah di-handle oleh event delegation di detailPinjam.ejs
    // Tidak perlu duplikat listener di sini
  
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowLeft') {
        const newIndex = currentIndex > 0 ? currentIndex - 1 : carouselItems.length - 1;
        updateCarousel(newIndex);
      } else if (e.key === 'ArrowRight') {
        const newIndex = currentIndex < carouselItems.length - 1 ? currentIndex + 1 : 0;
        updateCarousel(newIndex);
      }
    });
  
    // Touch/swipe support for mobile
    let touchStartX = 0;
    let touchEndX = 0;
    const carouselWrapper = document.querySelector('.carousel-3d-wrapper');
  
    if (carouselWrapper) {
      carouselWrapper.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
      });
  
      carouselWrapper.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
      });
  
      function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;
  
        if (Math.abs(diff) > swipeThreshold) {
          if (diff > 0) {
            const newIndex = currentIndex < carouselItems.length - 1 ? currentIndex + 1 : 0;
            updateCarousel(newIndex);
          } else {
            const newIndex = currentIndex > 0 ? currentIndex - 1 : carouselItems.length - 1;
            updateCarousel(newIndex);
          }
        }
      }
    }
  
    // Initialize carousel
    if (carouselItems.length > 0) {
      console.log('🎠 Initializing carousel with', carouselItems.length, 'items');
      updateCarousel(0);
    }
  
    // Responsive adjustments
    function handleResponsive() {
      const windowWidth = window.innerWidth;
      
      carouselItems.forEach((item, index) => {
        const diff = index - currentIndex;
        let transform = '';
        
        if (windowWidth <= 768) {
          if (diff === 0) {
            transform = 'translate(-50%, -50%) translateX(0) rotateY(0deg) scale(1)';
          } else if (diff === -1) {
            transform = 'translate(-50%, -50%) translateX(-150px) rotateY(20deg) scale(0.85)';
          } else if (diff === 1) {
            transform = 'translate(-50%, -50%) translateX(150px) rotateY(-20deg) scale(0.85)';
          } else if (diff < -1) {
            transform = 'translate(-50%, -50%) translateX(-300px) rotateY(30deg) scale(0.7)';
          } else {
            transform = 'translate(-50%, -50%) translateX(300px) rotateY(-30deg) scale(0.7)';
          }
        } else if (windowWidth <= 1024) {
          if (diff === 0) {
            transform = 'translate(-50%, -50%) translateX(0) rotateY(0deg) scale(1)';
          } else if (diff === -1) {
            transform = 'translate(-50%, -50%) translateX(-180px) rotateY(18deg) scale(0.9)';
          } else if (diff === -2) {
            transform = 'translate(-50%, -50%) translateX(-360px) rotateY(28deg) scale(0.8)';
          } else if (diff === 1) {
            transform = 'translate(-50%, -50%) translateX(180px) rotateY(-18deg) scale(0.9)';
          } else if (diff === 2) {
            transform = 'translate(-50%, -50%) translateX(360px) rotateY(-28deg) scale(0.8)';
          } else if (diff < -2) {
            transform = 'translate(-50%, -50%) translateX(-540px) rotateY(38deg) scale(0.7)';
          } else {
            transform = 'translate(-50%, -50%) translateX(540px) rotateY(-38deg) scale(0.7)';
          }
        }
        
        if (transform && windowWidth <= 1024) {
          item.style.transform = transform;
        }
      });
    }
  
    window.addEventListener('resize', handleResponsive);
    handleResponsive();
  
    // Export untuk digunakan oleh main.js
    window.carouselUpdateIndex = function(index) {
      updateCarousel(index);
    };
});